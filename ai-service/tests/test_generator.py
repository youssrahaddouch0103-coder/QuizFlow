import pytest

from app.generator import GenerationError, MockLlm, clean_question, generate_questions
from app.llm import LlmError
from app.schemas import ActivityType, ChoiceMode, GenerateRequest

COURSE = (
    "Le pattern Composite permet de composer des objets en structures arborescentes. "
    "Il permet aux clients de traiter de la même manière les objets individuels et les compositions. "
    "Le pattern Proxy fournit un substitut à un autre objet pour en contrôler l'accès."
)


class FakeLlm:
    """LLM simulé qui renvoie des réponses préparées, une par appel."""

    model = "fake"

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = 0

    def complete_json(self, system, user):
        self.calls += 1
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def test_clean_question_infers_multiple_mode():
    q = clean_question(
        {"text": "Patterns structurels ?", "choices": [
            {"label": "Composite", "correct": True}, {"label": "Proxy", "correct": True},
            {"label": "Observer", "correct": False}]},
        ActivityType.QUIZ)
    assert q is not None and q.choiceMode == ChoiceMode.MULTIPLE


def test_clean_question_rejects_quiz_without_correct_answer():
    assert clean_question({"text": "?", "choices": [{"label": "A"}, {"label": "B"}]}, ActivityType.QUIZ) is None


def test_clean_question_rejects_too_few_choices_and_duplicates():
    raw = {"text": "Q", "choices": [{"label": "A", "correct": True}, {"label": "a"}]}
    assert clean_question(raw, ActivityType.QUIZ) is None


def test_poll_answers_are_never_correct():
    q = clean_question({"text": "Compris ?", "choices": [{"label": "Oui", "correct": True}, "Non"]},
                       ActivityType.SONDAGE)
    assert q is not None and not any(c.correct for c in q.choices)


def test_generate_retries_to_fill_missing_questions():
    good = {"text": "Que fait Composite ?", "choices": [{"label": "Arbre", "correct": True}, {"label": "Accès"}]}
    good2 = {"text": "Que fait Proxy ?", "choices": [{"label": "Accès", "correct": True}, {"label": "Arbre"}]}
    bad = {"text": "Invalide", "choices": [{"label": "Seul"}]}
    llm = FakeLlm({"questions": [good, bad]}, {"questions": [good2]})
    res = generate_questions(GenerateRequest(text=COURSE, count=2), llm, max_attempts=2)
    assert [q.text for q in res.questions] == ["Que fait Composite ?", "Que fait Proxy ?"]
    assert llm.calls == 2


def test_generate_fails_when_nothing_is_usable():
    llm = FakeLlm(LlmError("quota"), {"questions": []})
    with pytest.raises(GenerationError):
        generate_questions(GenerateRequest(text=COURSE, count=2), llm, max_attempts=2)


def test_mock_llm_produces_valid_quiz_and_poll():
    quiz = generate_questions(GenerateRequest(text=COURSE, count=3), MockLlm())
    poll = generate_questions(GenerateRequest(text=COURSE, count=2, type=ActivityType.SONDAGE), MockLlm())
    assert len(quiz.questions) == 3 and all(any(c.correct for c in q.choices) for q in quiz.questions)
    assert len(poll.questions) == 2 and not any(c.correct for q in poll.questions for c in q.choices)


def test_page_references_are_removed_from_question_text():
    from app.generator import _strip_page_reference

    assert _strip_page_reference("Selon les pages 2-3, quelle propriété n'est pas un avantage ?") == "Quelle propriété n'est pas un avantage ?"
    assert _strip_page_reference("D'après la page 4, que fait TCP ?") == "Que fait TCP ?"
    assert _strip_page_reference("Selon le document, que fait UDP ?") == "Que fait UDP ?"
    assert _strip_page_reference(
        "Quelle affirmation décrit la différence entre un index clusterisé et un index non-clusterisé en SQL (pages 58-60) ?"
    ) == "Quelle affirmation décrit la différence entre un index clusterisé et un index non-clusterisé en SQL ?"
    assert _strip_page_reference("Que garantit TCP (p. 4) ?") == "Que garantit TCP ?"
    # Une question normale n'est pas modifiée.
    assert _strip_page_reference("Dans quel ordre TCP envoie-t-il les segments ?") == "Dans quel ordre TCP envoie-t-il les segments ?"


def test_page_references_are_removed_from_choices():
    from app.generator import clean_question
    from app.schemas import ActivityType

    q = clean_question(
        {"text": "Que garantit TCP ?", "choices": [{"label": "L'ordre des segments (page 4)", "correct": True}, "La vitesse (p. 5)"]},
        ActivityType.QUIZ,
    )
    assert [c.label for c in q.choices] == ["L'ordre des segments", "La vitesse"]
