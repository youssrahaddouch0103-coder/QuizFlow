"""Bibliothèque de documents des enseignants, stockée dans PostgreSQL avec l'extension pgvector.

Tables (schéma « rag », séparé des tables du backend gérées par Flyway) :
- rag.documents : un PDF importé (propriétaire, nom, nombre de pages, état du traitement) ;
- rag.chunks    : ses morceaux de texte, avec pages d'origine et vecteur (embedding) de 384 dimensions.

Recherche : distance cosinus (opérateur <=> de pgvector). On cherche toujours DANS un document
(quelques centaines de morceaux au plus) : un parcours exact est rapide et ne rate aucun résultat,
donc pas besoin d'index approximatif (HNSW) à cette échelle.
"""

from __future__ import annotations

import logging
import random
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Sequence

import psycopg
from psycopg.rows import dict_row

from .embeddings import DIM, Embedder
from .pdf import Chunk, PdfError, chunk_pages, extract_pages

log = logging.getLogger(__name__)

MAX_DOCUMENTS_PER_TEACHER = 30
# Nombre de passages vectorisés entre deux mises à jour de la progression.
INGEST_BATCH = 32

SCHEMA_SQL = f"""
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS rag;
CREATE TABLE IF NOT EXISTS rag.documents (
    id              uuid PRIMARY KEY,
    teacher_id      text        NOT NULL,
    filename        text        NOT NULL,
    title           text,
    size_bytes      integer     NOT NULL,
    pages           integer     NOT NULL DEFAULT 0,
    chunks          integer     NOT NULL DEFAULT 0,
    status          text        NOT NULL,
    progress        integer     NOT NULL DEFAULT 0,
    error           text,
    embedding_model text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rag.documents ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS documents_teacher_idx ON rag.documents (teacher_id, created_at DESC);
CREATE TABLE IF NOT EXISTS rag.chunks (
    id          bigserial PRIMARY KEY,
    document_id uuid    NOT NULL REFERENCES rag.documents (id) ON DELETE CASCADE,
    ord         integer NOT NULL,
    page_start  integer NOT NULL,
    page_end    integer NOT NULL,
    content     text    NOT NULL,
    page_marks  integer[] NOT NULL DEFAULT '{{}}',
    embedding   vector({DIM}) NOT NULL
);
ALTER TABLE rag.chunks ADD COLUMN IF NOT EXISTS page_marks integer[] NOT NULL DEFAULT '{{}}';
CREATE INDEX IF NOT EXISTS chunks_document_idx ON rag.chunks (document_id, ord);
"""


class DocumentError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass
class DocumentRow:
    id: str
    filename: str
    title: str | None
    size_bytes: int
    pages: int
    chunks: int
    status: str  # PROCESSING | READY | FAILED
    error: str | None
    embedding_model: str
    created_at: datetime
    progress: int = 0  # 0 à 100 pendant l'analyse


@dataclass
class ChunkHit:
    ord: int
    page_start: int
    page_end: int
    content: str
    embedding: list[float]
    score: float = 0.0
    page_marks: tuple[tuple[int, int], ...] = ()

    def page_at(self, position: int) -> int:
        page = self.page_start
        for offset, p in self.page_marks:
            if offset <= position:
                page = p
        return page

    @property
    def pages_label(self) -> str:
        return str(self.page_start) if self.page_start == self.page_end else f"{self.page_start}-{self.page_end}"


def to_vector(v: Sequence[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def from_vector(text: str) -> list[float]:
    return [float(x) for x in text.strip("[]").split(",") if x]


class DocumentStore:
    def __init__(self, dsn: str, embedder: Embedder):
        self.dsn = dsn
        self.embedder = embedder

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self.dsn, row_factory=dict_row)

    def init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(SCHEMA_SQL)
            # Un traitement interrompu (redémarrage du service) ne reprendra pas tout seul.
            conn.execute(
                "UPDATE rag.documents SET status = 'FAILED', error = %s WHERE status = 'PROCESSING'",
                ("Traitement interrompu par un redémarrage, réimportez le fichier.",),
            )

    # ---------- Lecture ----------

    @staticmethod
    def _row(r: dict) -> DocumentRow:
        return DocumentRow(
            id=str(r["id"]),
            filename=r["filename"],
            title=r["title"],
            size_bytes=r["size_bytes"],
            pages=r["pages"],
            chunks=r["chunks"],
            status=r["status"],
            error=r["error"],
            progress=r["progress"],
            embedding_model=r["embedding_model"],
            created_at=r["created_at"],
        )

    def list(self, teacher_id: str) -> list[DocumentRow]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM rag.documents WHERE teacher_id = %s ORDER BY created_at DESC", (teacher_id,)
            ).fetchall()
        return [self._row(r) for r in rows]

    def get(self, teacher_id: str, document_id: str) -> DocumentRow:
        try:
            uuid.UUID(document_id)
        except ValueError:
            raise DocumentError(404, "DOCUMENT_NOT_FOUND", "Document introuvable") from None
        with self._connect() as conn:
            r = conn.execute(
                "SELECT * FROM rag.documents WHERE id = %s AND teacher_id = %s", (document_id, teacher_id)
            ).fetchone()
        if not r:
            raise DocumentError(404, "DOCUMENT_NOT_FOUND", "Document introuvable")
        return self._row(r)

    def delete(self, teacher_id: str, document_id: str) -> None:
        self.get(teacher_id, document_id)
        with self._connect() as conn:
            conn.execute("DELETE FROM rag.documents WHERE id = %s AND teacher_id = %s", (document_id, teacher_id))

    # ---------- Import ----------

    def create(self, teacher_id: str, filename: str, size_bytes: int) -> DocumentRow:
        with self._connect() as conn:
            (count,) = conn.execute(
                "SELECT count(*) FROM rag.documents WHERE teacher_id = %s", (teacher_id,)
            ).fetchone().values()
            if count >= MAX_DOCUMENTS_PER_TEACHER:
                raise DocumentError(
                    409, "DOCUMENT_LIMIT", f"Limite de {MAX_DOCUMENTS_PER_TEACHER} documents atteinte : supprimez-en un."
                )
            r = conn.execute(
                """INSERT INTO rag.documents (id, teacher_id, filename, size_bytes, status, embedding_model)
                   VALUES (%s, %s, %s, %s, 'PROCESSING', %s) RETURNING *""",
                (uuid.uuid4(), teacher_id, filename[:200], size_bytes, self.embedder.name),
            ).fetchone()
        return self._row(r)

    def ingest(self, document_id: str, data: bytes) -> None:
        """Lit le PDF, le découpe, calcule les vecteurs et enregistre tout. Appelé en tâche de fond."""
        try:
            t0 = time.perf_counter()
            pages, title = extract_pages(data)
            chunks = chunk_pages(pages)
            if not chunks:
                raise PdfError("Pas assez de texte exploitable dans ce PDF.")
            t1 = time.perf_counter()
            self._set_progress(document_id, 5)
            # Embeddings par lots, avec une progression visible dans l'interface (5 % -> 95 %).
            vectors: list[list[float]] = []
            texts = [c.content for c in chunks]
            for i in range(0, len(texts), INGEST_BATCH):
                vectors += self.embedder.embed_passages(texts[i : i + INGEST_BATCH])
                self._set_progress(document_id, 5 + int(90 * len(vectors) / len(texts)))
            t2 = time.perf_counter()
            self._save(document_id, title, len(pages), chunks, vectors)
            t3 = time.perf_counter()
            log.info(
                "Document %s indexé : %s pages, %s morceaux | lecture PDF %.1f s, embeddings %.1f s, base %.1f s",
                document_id, len(pages), len(chunks), t1 - t0, t2 - t1, t3 - t2,
            )
        except PdfError as e:
            self._fail(document_id, str(e))
        except Exception:
            log.exception("Échec de l'indexation du document %s", document_id)
            self._fail(document_id, "Erreur pendant le traitement du PDF, réessayez.")

    def _save(self, document_id: str, title: str | None, pages: int, chunks: list[Chunk], vectors) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """INSERT INTO rag.chunks (document_id, ord, page_start, page_end, content, page_marks, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s, %s::vector)""",
                    [
                        (document_id, c.ord, c.page_start, c.page_end, c.content,
                         [x for mark in c.page_marks for x in mark], to_vector(v))
                        for c, v in zip(chunks, vectors)
                    ],
                )
            conn.execute(
                """UPDATE rag.documents SET status = 'READY', title = %s, pages = %s, chunks = %s, error = NULL,
                          progress = 100 WHERE id = %s""",
                (title, pages, len(chunks), document_id),
            )

    def _set_progress(self, document_id: str, progress: int) -> None:
        with self._connect() as conn:
            conn.execute("UPDATE rag.documents SET progress = %s WHERE id = %s", (min(progress, 99), document_id))

    def _fail(self, document_id: str, message: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE rag.documents SET status = 'FAILED', error = %s WHERE id = %s", (message, document_id)
            )

    # ---------- Recherche ----------

    def ready_document(self, teacher_id: str, document_id: str) -> DocumentRow:
        doc = self.get(teacher_id, document_id)
        if doc.status == "PROCESSING":
            raise DocumentError(409, "DOCUMENT_PROCESSING", "Ce document est encore en cours de traitement.")
        if doc.status != "READY":
            raise DocumentError(409, "DOCUMENT_FAILED", doc.error or "Ce document n'a pas pu être traité.")
        if doc.embedding_model != self.embedder.name:
            raise DocumentError(
                409, "DOCUMENT_STALE", "Ce document a été indexé avec un autre modèle : réimportez-le."
            )
        return doc

    def search(self, document_id: str, query: str, k: int) -> list[ChunkHit]:
        """Les k morceaux les plus proches de la requête (similarité cosinus)."""
        qv = self.embedder.embed_queries([query])[0]
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT ord, page_start, page_end, content, page_marks, embedding::text AS emb,
                          1 - (embedding <=> %s::vector) AS score
                   FROM rag.chunks WHERE document_id = %s
                   ORDER BY embedding <=> %s::vector LIMIT %s""",
                (to_vector(qv), document_id, to_vector(qv), k),
            ).fetchall()
        return [self._hit(r) for r in rows]

    def spread(self, document_id: str, k: int, rng: random.Random | None = None) -> list[ChunkHit]:
        """Sans sujet précis : k morceaux répartis sur tout le document, pour couvrir l'ensemble du cours.

        Un petit décalage aléatoire fait qu'une nouvelle génération pioche d'autres passages.
        """
        rng = rng or random.Random()
        with self._connect() as conn:
            (total,) = conn.execute(
                "SELECT count(*) FROM rag.chunks WHERE document_id = %s", (document_id,)
            ).fetchone().values()
            if total == 0:
                return []
            k = min(k, total)
            step = total / k
            offset = rng.random() * step
            wanted = sorted({min(total - 1, int(offset + i * step)) for i in range(k)})
            rows = conn.execute(
                """SELECT ord, page_start, page_end, content, page_marks, embedding::text AS emb, 0.0 AS score
                   FROM rag.chunks WHERE document_id = %s AND ord = ANY(%s) ORDER BY ord""",
                (document_id, wanted),
            ).fetchall()
        return [self._hit(r) for r in rows]

    @staticmethod
    def _hit(r: dict) -> ChunkHit:
        return ChunkHit(
            ord=r["ord"],
            page_start=r["page_start"],
            page_end=r["page_end"],
            content=r["content"],
            embedding=from_vector(r["emb"]),
            score=float(r["score"]),
            page_marks=tuple(zip(r["page_marks"][0::2], r["page_marks"][1::2])),
        )
