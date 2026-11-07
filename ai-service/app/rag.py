"""Génération de questions à partir d'un document importé (RAG : Retrieval-Augmented Generation).

1. Recherche  : on retrouve les passages utiles du PDF (recherche vectorielle si un sujet est donné,
                sinon des passages répartis sur tout le document).
2. Génération  : le LLM ne voit que ces passages, étiquetés avec leurs pages.
3. Vérification : pour chaque question, on recalcule quel passage la justifie le mieux
                (similarité entre la question + sa bonne réponse et chaque passage). Cela corrige
                une page mal citée par le LLM et fournit un extrait que l'enseignant peut relire.
"""

from __future__ import annotations

import logging

from .documents import ChunkHit, DocumentRow, DocumentStore
from .embeddings import Embedder, cosine
from .generator import generate_questions
from .llm import LlmClient
from .pdf import split_sentences
from .prompts import build_document_prompt
from .schemas import DocumentGenerateRequest, GeneratedQuestion, GenerateRequest, GenerateResponse, QuestionSource

log = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 14000
EXCERPT_CHARS = 240
# Écart de similarité au-delà duquel on préfère le meilleur passage à la page citée par le LLM.
CITATION_TOLERANCE = 0.05


class RagError(Exception):
    pass


def passages_for(store: DocumentStore, doc: DocumentRow, req: DocumentGenerateRequest) -> list[ChunkHit]:
    k = min(10, max(4, req.count + 3))
    topic = (req.topic or "").strip()
    hits = store.search(doc.id, topic, k) if topic else store.spread(doc.id, k)
    # Ordre du document : le LLM lit les passages dans l'ordre du cours.
    hits.sort(key=lambda h: h.ord)
    kept, size = [], 0
    for h in hits:
        if size + len(h.content) > MAX_CONTEXT_CHARS:
            break
        kept.append(h)
        size += len(h.content)
    return kept


def generate_from_document(
    store: DocumentStore,
    llm: LlmClient,
    doc: DocumentRow,
    req: DocumentGenerateRequest,
    max_attempts: int = 2,
) -> GenerateResponse:
    hits = passages_for(store, doc, req)
    if not hits:
        raise RagError("Aucun passage exploitable dans ce document.")
    passages = [(h.pages_label, h.content) for h in hits]
    gen_req = GenerateRequest(
        text="\n".join(h.content for h in hits)[:20000],
        type=req.type,
        count=req.count,
        language=req.language,
        difficulty=req.difficulty,
    )
    resp = generate_questions(
        gen_req, llm, max_attempts, build_prompt=lambda r: build_document_prompt(r, passages, req.topic)
    )
    attach_sources(resp.questions, hits, store.embedder, doc)
    return resp


def _question_text(q: GeneratedQuestion) -> str:
    good = [c.label for c in q.choices if c.correct]
    return " ".join([q.text, *good])


def attach_sources(questions: list[GeneratedQuestion], hits: list[ChunkHit], embedder: Embedder, doc: DocumentRow) -> None:
    """Ajoute à chaque question sa source : pages, extrait justificatif et score de similarité."""
    if not questions or not hits:
        return
    q_vectors = embedder.embed_queries([_question_text(q) for q in questions])
    for q, qv in zip(questions, q_vectors):
        scored = [(cosine(qv, h.embedding), h) for h in hits]
        cited = q.source.pages if q.source else []
        # Pages citées par le LLM, si elles correspondent bien à un passage fourni.
        covering = [(s, h) for s, h in scored if any(h.page_start <= p <= h.page_end for p in cited)]
        best_score, best = max(scored, key=lambda t: t[0])
        if covering:
            cov_score, cov = max(covering, key=lambda t: t[0])
            # On garde la page citée sauf si un autre passage justifie nettement mieux la question.
            if cov_score >= best_score - CITATION_TOLERANCE:
                best_score, best = cov_score, cov
        sentence = _best_sentence(best.content, qv, embedder)
        # Page précise : celle où se trouve la phrase justificative dans le passage.
        position = best.content.find(sentence.rstrip("…"))
        sentence_page = best.page_at(position) if position >= 0 else best.page_start
        pages = [p for p in cited if best.page_start <= p <= best.page_end]
        if not pages or sentence_page not in pages:
            pages = [sentence_page] if not pages else sorted({*pages, sentence_page})
        q.source = QuestionSource(
            documentId=doc.id,
            documentName=doc.title or doc.filename,
            pages=pages,
            excerpt=sentence,
            score=round(best_score, 3),
        )


def _best_sentence(content: str, qv: list[float], embedder: Embedder) -> str:
    sentences = split_sentences(content) or [content]
    vectors = embedder.embed_passages(sentences)
    best = max(zip(sentences, vectors), key=lambda t: cosine(qv, t[1]))[0]
    return best if len(best) <= EXCERPT_CHARS else best[: EXCERPT_CHARS - 1].rstrip() + "…"
