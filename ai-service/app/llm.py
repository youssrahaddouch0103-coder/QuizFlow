"""Client minimal pour les API compatibles OpenAI (Groq, Gemini, Ollama, ...)."""

import json
from typing import Protocol

import httpx

from .config import Settings


class LlmError(Exception):
    """Erreur d'appel au LLM (réseau, quota, réponse illisible)."""


class LlmClient(Protocol):
    model: str

    def complete_json(self, system: str, user: str) -> dict: ...


class OpenAICompatibleClient:
    def __init__(self, settings: Settings):
        self.model = settings.model
        self._settings = settings

    def complete_json(self, system: str, user: str) -> dict:
        try:
            return self._call(system, user, json_mode=True)
        except LlmError as e:
            # Certains modèles refusent "response_format" : on réessaie sans, le prompt exige déjà du JSON.
            if "response_format" in str(e) or "json" in str(e).lower():
                return self._call(system, user, json_mode=False)
            raise

    def _call(self, system: str, user: str, json_mode: bool) -> dict:
        payload = {
            "model": self._settings.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.4,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        headers = {"Authorization": f"Bearer {self._settings.api_key}"}
        try:
            resp = httpx.post(
                f"{self._settings.base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=self._settings.timeout_seconds,
            )
        except httpx.HTTPError as e:
            raise LlmError(f"LLM injoignable : {e}") from e
        if resp.status_code != 200:
            raise LlmError(f"LLM a répondu {resp.status_code} : {resp.text[:300]}")
        try:
            content = resp.json()["choices"][0]["message"]["content"] or ""
            return json.loads(_strip_fences(content))
        except (KeyError, IndexError, ValueError) as e:
            raise LlmError("Réponse du LLM illisible") from e


def _strip_fences(text: str) -> str:
    """Retire d'éventuels ```json ... ``` autour de la réponse."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0]
    return text.strip()
