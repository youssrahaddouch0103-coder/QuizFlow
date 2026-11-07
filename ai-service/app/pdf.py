"""Lecture des PDF et découpage du texte en morceaux (« chunks ») pour la recherche.

Chaque morceau garde les numéros de page d'où il vient : c'est ce qui permet ensuite de citer
la source de chaque question générée (« p. 4 »).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

from pypdf import PdfReader
from pypdf.errors import PdfReadError

MAX_PAGES = 300
MIN_TEXT_CHARS = 200


class PdfError(Exception):
    """PDF illisible, protégé, trop long ou sans texte (scan)."""


@dataclass(frozen=True)
class Chunk:
    ord: int
    page_start: int
    page_end: int
    content: str
    # Débuts de page dans le texte du morceau : [(position du caractère, numéro de page), ...].
    page_marks: tuple[tuple[int, int], ...] = ()

    def page_at(self, position: int) -> int:
        """Numéro de page du caractère situé à `position` dans le morceau."""
        page = self.page_start
        for offset, p in self.page_marks:
            if offset <= position:
                page = p
        return page


def _clean(text: str) -> str:
    text = text.replace("\u00ad", "")  # tirets conditionnels
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # mots coupés en fin de ligne : « photo-\nsynthèse »
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip()


def extract_pages(data: bytes) -> tuple[list[str], str | None]:
    """Renvoie le texte de chaque page (index 0 = page 1) et le titre du PDF s'il est renseigné."""
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception as e:
                raise PdfError("Ce PDF est protégé par un mot de passe.") from e
        if len(reader.pages) > MAX_PAGES:
            raise PdfError(f"Ce PDF a {len(reader.pages)} pages : la limite est de {MAX_PAGES}.")
        pages = [_clean(p.extract_text() or "") for p in reader.pages]
        title = None
        if reader.metadata and reader.metadata.title:
            title = str(reader.metadata.title).strip() or None
    except PdfError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError) as e:
        raise PdfError("Fichier PDF illisible ou endommagé.") from e
    if sum(len(p) for p in pages) < MIN_TEXT_CHARS:
        raise PdfError(
            "Aucun texte trouvé dans ce PDF : il s'agit sans doute d'un document scanné (images). "
            "Utilisez un PDF exporté depuis Word, PowerPoint ou LaTeX."
        )
    return pages, title


def chunk_pages(pages: list[str], target_words: int = 180, overlap_words: int = 40) -> list[Chunk]:
    """Découpe le document en morceaux d'environ `target_words` mots qui se chevauchent.

    Le chevauchement évite qu'une idée coupée entre deux morceaux soit perdue. On coupe de
    préférence en fin de phrase, et chaque morceau retient la plage de pages qu'il couvre.
    """
    words: list[tuple[str, int]] = []  # (mot, numéro de page)
    for page_no, text in enumerate(pages, start=1):
        for w in text.split():
            words.append((w, page_no))

    chunks: list[Chunk] = []
    start = 0
    n = len(words)
    while start < n:
        end = min(start + target_words, n)
        # Finir sur une fin de phrase si elle est proche (dans les 30 derniers mots).
        if end < n:
            for j in range(end, max(start + target_words - 30, start + 1), -1):
                if words[j - 1][0].endswith((".", "?", "!", ":")):
                    end = j
                    break
        piece = words[start:end]
        parts, marks, pos, current = [], [], 0, None
        for w, p in piece:
            if p != current:
                marks.append((pos, p))
                current = p
            parts.append(w)
            pos += len(w) + 1
        content = " ".join(parts)
        if len(content) >= 40:
            chunks.append(Chunk(ord=len(chunks), page_start=piece[0][1], page_end=piece[-1][1], content=content,
                                page_marks=tuple(marks)))
        if end >= n:
            break
        start = max(end - overlap_words, start + 1)
    return chunks


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) > 25]
