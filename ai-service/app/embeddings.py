"""Embeddings (vecteurs) des morceaux de cours et des requêtes.

Modèle : intfloat/multilingual-e5-small (384 dimensions, ~100 langues dont français, arabe, anglais).
Il tourne en local sur CPU via ONNX Runtime (bibliothèque fastembed) : pas de GPU, pas de PyTorch,
et le texte des cours ne quitte pas le serveur pour être vectorisé.

Particularité des modèles E5 : on préfixe les textes par « passage: » (contenu indexé) ou
« query: » (recherche). Sans ces préfixes, la qualité de recherche baisse nettement.

Lancer `python -m app.embeddings` télécharge le modèle à l'avance (utilisé dans le Dockerfile).
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import re
import threading
import time
import unicodedata
from typing import Protocol, Sequence

log = logging.getLogger(__name__)

DIM = 384
E5_NAME = "intfloat/multilingual-e5-small"
# Dépôts Hugging Face essayés dans l'ordre (même modèle, export ONNX).
E5_SOURCES = [
    ("intfloat/multilingual-e5-small", "onnx/model.onnx"),
    ("Xenova/multilingual-e5-small", "onnx/model.onnx"),
]


class Embedder(Protocol):
    name: str
    dim: int

    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]: ...

    def embed_queries(self, texts: Sequence[str]) -> list[list[float]]: ...


class E5Embedder:
    """multilingual-e5-small via fastembed. Le modèle est chargé au premier usage (ou par warm_up)."""

    name = E5_NAME
    dim = DIM

    def __init__(self, cache_dir: str | None = None, batch_size: int = 32):
        self._cache_dir = cache_dir or os.getenv("EMBEDDING_CACHE_DIR") or None
        self._batch_size = batch_size
        # Utiliser tous les cœurs disponibles (Docker Desktop en limite parfois le nombre).
        self._threads = int(os.getenv("EMBEDDING_THREADS", "0")) or (os.cpu_count() or 1)
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            from fastembed import TextEmbedding
            from fastembed.common.model_description import ModelSource, PoolingType

            errors = []
            for repo, onnx_file in E5_SOURCES:
                try:
                    if not any(m["model"] == repo for m in TextEmbedding.list_supported_models()):
                        TextEmbedding.add_custom_model(
                            model=repo,
                            pooling=PoolingType.MEAN,
                            normalization=True,
                            sources=ModelSource(hf=repo),
                            dim=DIM,
                            model_file=onnx_file,
                        )
                    started = time.perf_counter()
                    self._model = TextEmbedding(repo, cache_dir=self._cache_dir, threads=self._threads)
                    log.info("Modèle d'embeddings chargé : %s (%.1f s, %s threads)", repo,
                             time.perf_counter() - started, self._threads)
                    return self._model
                except Exception as e:  # réseau, fichier absent dans ce dépôt...
                    errors.append(f"{repo}: {e}")
            raise RuntimeError("Impossible de charger multilingual-e5-small : " + " | ".join(errors))

    def warm_up(self) -> None:
        self._load()

    def _embed(self, texts: Sequence[str]) -> list[list[float]]:
        model = self._load()
        return [list(map(float, v)) for v in model.embed(list(texts), batch_size=self._batch_size)]

    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        return self._embed([f"passage: {t}" for t in texts])

    def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        return self._embed([f"query: {t}" for t in texts])


_WORD = re.compile(r"[a-z0-9]+")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


class HashEmbedder:
    """Embeddings « sac de mots » hachés : sans réseau ni modèle, pour les tests et le mode hors ligne.

    Ce n'est pas un modèle sémantique (pas de synonymes), mais deux textes qui partagent des mots
    ont des vecteurs proches : suffisant pour tester toute la chaîne RAG.
    """

    name = "hash-bow"
    dim = DIM

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * DIM
        words = [w for w in _WORD.findall(_normalize(text)) if len(w) > 2]
        for w in words:
            h = int(hashlib.md5(w.encode()).hexdigest(), 16)
            v[h % DIM] += 1.0 if (h >> 9) % 2 else -1.0
        norm = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / norm for x in v]

    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Similarité cosinus (les vecteurs sont déjà normalisés : c'est un produit scalaire)."""
    return float(sum(x * y for x, y in zip(a, b)))


def load_embedder() -> Embedder:
    provider = (os.getenv("EMBEDDING_PROVIDER") or "e5").strip().lower()
    return HashEmbedder() if provider == "hash" else E5Embedder()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    emb = E5Embedder()
    emb.warm_up()
    print("OK, dimension :", len(emb.embed_queries(["test"])[0]))
