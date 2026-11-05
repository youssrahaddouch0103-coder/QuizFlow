"""Microservice IA de QuizFlow (FastAPI).

Lancer en local :  uvicorn app.main:app --reload --port 8000
Documentation interactive : http://localhost:8000/docs
"""

import logging

from fastapi import FastAPI, HTTPException

from .config import load_settings
from .generator import GenerationError, MockLlm, generate_questions
from .llm import OpenAICompatibleClient
from .schemas import GenerateRequest, GenerateResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("ai-service")

settings = load_settings()
llm = MockLlm() if settings.is_mock else OpenAICompatibleClient(settings)
log.info("Fournisseur LLM : %s (modèle %s)", settings.provider, llm.model)

app = FastAPI(title="QuizFlow - service IA", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "provider": settings.provider, "model": llm.model}


@app.post("/v1/questions/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        return generate_questions(req, llm, max_attempts=settings.max_attempts)
    except GenerationError as e:
        log.warning("Génération impossible : %s", e)
        raise HTTPException(status_code=502, detail="Le LLM n'a produit aucune question exploitable") from e
