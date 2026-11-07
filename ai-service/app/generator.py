"""Génération de questions : appel au LLM, puis contrôle et nettoyage de sa réponse.

Un LLM peut se tromper de format : on ne fait jamais confiance à sa sortie brute. Chaque question
est vérifiée avec les mêmes règles que le backend (W2) ; les questions invalides sont écartées
et on relance si nécessaire.
"""

import logging
import re
from typing import Callable

from .llm import LlmClient, LlmError
from .prompts import SYSTEM_PROMPT, build_user_prompt
from .schemas import (
    ActivityType,
    ChoiceMode,
    GeneratedChoice,
    GeneratedQuestion,
    GenerateRequest,
    GenerateResponse,
    QuestionSource,
)

log = logging.getLogger(__name__)

MIN_CHOICES, MAX_CHOICES = 2, 6
MAX_TEXT, MAX_LABEL = 500, 200


class GenerationError(Exception):
    """Aucune question exploitable n'a pu être produite."""


def clean_question(raw: object, activity_type: ActivityType) -> GeneratedQuestion | None:
    """Transforme un élément brut renvoyé par le LLM en question valide, ou None s'il est inutilisable."""
    if not isinstance(raw, dict):
        return None
    text = _strip_page_reference(str(raw.get("text") or raw.get("question") or "").strip())
    if not text or len(text) > MAX_TEXT:
        return None

    choices: list[GeneratedChoice] = []
    seen: set[str] = set()
    for c in raw.get("choices") or []:
        if isinstance(c, str):
            label, correct = _strip_page_reference(c.strip()), False
        elif isinstance(c, dict):
            label = _strip_page_reference(str(c.get("label") or c.get("text") or "").strip())
            correct = bool(c.get("correct", False))
        else:
            continue
        if not label or len(label) > MAX_LABEL or label.lower() in seen:
            continue
        seen.add(label.lower())
        choices.append(GeneratedChoice(label=label, correct=correct))

    if not MIN_CHOICES <= len(choices) <= MAX_CHOICES:
        return None

    if activity_type == ActivityType.SONDAGE:
        choices = [GeneratedChoice(label=c.label, correct=False) for c in choices]
        mode = ChoiceMode.UNIQUE
    else:
        nb_correct = sum(c.correct for c in choices)
        if nb_correct == 0:
            return None
        mode = ChoiceMode.MULTIPLE if nb_correct > 1 else ChoiceMode.UNIQUE

    explanation = raw.get("explanation")
    return GeneratedQuestion(
        text=text,
        choiceMode=mode,
        choices=choices,
        explanation=str(explanation).strip() if explanation else None,
        source=_clean_pages(raw.get("pages")),
    )


_PAGE_REF = re.compile(
    r"^(selon|d['’]après|d'apres|dans|en vous basant sur|sur la base de)\s+(le document|le cours|l['’]extrait|la|les)?\s*"
    r"(pages?|p\.)?\s*[\d\s,\-–àet]*\s*(du document|du cours)?\s*,\s*",
    re.IGNORECASE,
)


_PAGE_PAREN = re.compile(r"\s*\((?:voir\s+)?(?:pages?|p\.)\s*[\d\s,\-–àet]+\)", re.IGNORECASE)


def _strip_page_reference(text: str) -> str:
    """Filet de sécurité (les élèves n'ont pas le PDF) : retire « Selon les pages 2-3, » en début de
    question et les mentions entre parenthèses comme « (pages 58-60) » ou « (p. 4) »."""
    cleaned = _PAGE_PAREN.sub("", text).strip()
    cleaned = _PAGE_REF.sub("", cleaned, count=1)
    if cleaned != text and cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned or text


def _clean_pages(raw: object) -> QuestionSource | None:
    """Pages citées par le LLM (mode document) : on ne garde que des entiers plausibles."""
    if not isinstance(raw, list):
        return None
    pages = sorted({int(p) for p in raw if isinstance(p, (int, float, str)) and str(p).strip().isdigit() and 0 < int(p) < 10000})
    return QuestionSource(pages=pages) if pages else None


def generate_questions(
    req: GenerateRequest,
    llm: LlmClient,
    max_attempts: int = 2,
    build_prompt: Callable[[GenerateRequest], str] = build_user_prompt,
) -> GenerateResponse:
    questions: list[GeneratedQuestion] = []
    seen_texts: set[str] = set()
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        missing = req.count - len(questions)
        if missing <= 0:
            break
        sub_req = req.model_copy(update={"count": missing})
        try:
            data = llm.complete_json(SYSTEM_PROMPT, build_prompt(sub_req))
        except LlmError as e:
            log.warning("Tentative %s : %s", attempt, e)
            last_error = e
            continue
        raw_questions = data.get("questions") if isinstance(data, dict) else None
        for raw in raw_questions or []:
            q = clean_question(raw, req.type)
            if q and q.text.lower() not in seen_texts:
                seen_texts.add(q.text.lower())
                questions.append(q)
        log.info("Tentative %s : %s question(s) valide(s) sur %s demandée(s)", attempt, len(questions), req.count)

    if not questions:
        raise GenerationError(str(last_error) if last_error else "Aucune question valide générée")
    return GenerateResponse(questions=questions[: req.count], model=llm.model)


class MockLlm:
    """Générateur factice, sans réseau : utilisé sans clé d'API (démo) et dans les tests.

    Il découpe le texte en phrases et en fait des questions simples. Ce n'est PAS de l'IA :
    il permet seulement de tester toute la chaîne sans dépendre d'un fournisseur.
    """

    model = "mock"

    def complete_json(self, system: str, user: str) -> dict:
        match = re.search(r"<cours>\n(.*)\n</cours>", user, re.S)
        text = match.group(1) if match else user
        text = re.sub(r"</?extrait[^>]*>", " ", text)  # mode document : on retire les balises de pages
        count_match = re.search(r"exactement (\d+)", user)
        count = int(count_match.group(1)) if count_match else 3
        is_poll = "sondage" in user.split("\n", 1)[0]
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]
        questions = []
        for i in range(count):
            sentence = sentences[i % len(sentences)] if sentences else text[:120]
            if is_poll:
                questions.append({
                    "text": f"Avez-vous compris ce point : « {sentence[:120]} » ?",
                    "choices": [{"label": "Oui, clairement"}, {"label": "En partie"}, {"label": "Non, à réexpliquer"}],
                })
            else:
                questions.append({
                    "text": f"(Démo) Cette affirmation est-elle tirée du cours : « {sentence[:120]} » ?",
                    "choices": [{"label": "Vrai", "correct": True}, {"label": "Faux", "correct": False}],
                    "explanation": "Question de démonstration générée sans LLM.",
                })
        return {"questions": questions}
