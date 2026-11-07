"""Configuration du service IA, lue dans les variables d'environnement (fichier .env)."""

import os
from dataclasses import dataclass

# Fournisseurs compatibles avec l'API OpenAI (même format de requête).
PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "openai/gpt-oss-120b",  # llama-3.3-70b-versatile a été retiré par Groq le 16/08/2026
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash",
    },
}


@dataclass(frozen=True)
class Settings:
    provider: str
    api_key: str
    base_url: str
    model: str
    timeout_seconds: float
    max_attempts: int
    # RAG : base PostgreSQL + pgvector. Vide = import de PDF désactivé (la génération par texte reste dispo).
    database_url: str = ""
    # Secret partagé avec le backend : seuls les appels portant ce jeton sont acceptés (vide = pas de contrôle).
    internal_token: str = ""
    max_upload_mb: int = 20

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock"


def load_settings() -> Settings:
    provider = (os.getenv("LLM_PROVIDER") or "groq").strip().lower()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    # Sans clé, on bascule sur le générateur factice : l'application reste utilisable en démo.
    if not api_key and provider != "mock":
        provider = "mock"
    defaults = PROVIDERS.get(provider, {"base_url": "", "model": "mock"})
    return Settings(
        provider=provider,
        api_key=api_key,
        base_url=(os.getenv("LLM_BASE_URL") or defaults["base_url"]).rstrip("/"),
        model=os.getenv("LLM_MODEL") or defaults["model"],
        timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "60")),
        max_attempts=int(os.getenv("LLM_MAX_ATTEMPTS", "2")),
        database_url=os.getenv("DATABASE_URL", "").strip(),
        internal_token=os.getenv("AI_INTERNAL_TOKEN", "").strip(),
        max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "20")),
    )
