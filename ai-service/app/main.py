"""Microservice IA de QuizFlow (FastAPI).

Lancer en local :  uvicorn app.main:app --reload --port 8000
Documentation interactive : http://localhost:8000/docs

Deux façons de générer des questions :
- à partir d'un texte collé           : POST /v1/questions/generate
- à partir d'un PDF de la bibliothèque : POST /v1/documents/{id}/questions  (RAG, avec pages citées)
"""

import hmac
import logging
import threading
import time
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import load_settings
from .documents import DocumentError, DocumentRow, DocumentStore
from .embeddings import load_embedder
from .generator import GenerationError, MockLlm, generate_questions
from .llm import OpenAICompatibleClient
from .rag import RagError, generate_from_document
from .schemas import DocumentGenerateRequest, DocumentView, GenerateRequest, GenerateResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("ai-service")

settings = load_settings()
llm = MockLlm() if settings.is_mock else OpenAICompatibleClient(settings)
log.info("Fournisseur LLM : %s (modèle %s)", settings.provider, llm.model)

embedder = load_embedder()
store: DocumentStore | None = DocumentStore(settings.database_url, embedder) if settings.database_url else None

def startup() -> None:
    if store is None:
        log.info("DATABASE_URL absent : import de PDF (RAG) désactivé")
        return
    # La base peut démarrer un peu après nous : quelques essais avant d'abandonner.
    for attempt in range(1, 16):
        try:
            store.init_schema()
            log.info("Schéma RAG prêt (pgvector), embeddings : %s", embedder.name)
            break
        except Exception as e:
            log.warning("Base RAG indisponible (essai %s) : %s", attempt, e)
            time.sleep(2)
    # Charger le modèle d'embeddings en arrière-plan : le premier import sera plus rapide.
    warm_up = getattr(embedder, "warm_up", None)
    if warm_up:
        threading.Thread(target=_safe_warm_up, args=(warm_up,), daemon=True).start()


def _safe_warm_up(fn) -> None:
    try:
        fn()
    except Exception as e:
        log.warning("Modèle d'embeddings non chargé pour l'instant : %s", e)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    startup()
    yield


app = FastAPI(title="QuizFlow - service IA", version="0.2.0", lifespan=lifespan)


@app.exception_handler(DocumentError)
def document_error(_, e: DocumentError) -> JSONResponse:
    return JSONResponse(status_code=e.status, content={"code": e.code, "message": e.message})


# ---------- Sécurité : appels réservés au backend ----------


def check_internal(x_internal_token: str = Header(default="")) -> None:
    if settings.internal_token and not hmac.compare_digest(x_internal_token, settings.internal_token):
        raise HTTPException(status_code=401, detail="Jeton interne invalide")


def teacher(x_teacher_id: str = Header(default="")) -> str:
    """Identifiant de l'enseignant connecté, transmis par le backend (qui a vérifié son JWT)."""
    if not x_teacher_id.strip():
        raise HTTPException(status_code=400, detail="En-tête X-Teacher-Id manquant")
    return x_teacher_id.strip()


def rag_store() -> DocumentStore:
    if store is None:
        raise DocumentError(503, "RAG_DISABLED", "L'import de documents n'est pas configuré sur ce serveur.")
    return store


# ---------- Routes ----------


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "provider": settings.provider, "model": llm.model, "rag": store is not None,
            "embeddings": embedder.name}


@app.post("/v1/questions/generate", response_model=GenerateResponse, dependencies=[Depends(check_internal)])
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        return generate_questions(req, llm, max_attempts=settings.max_attempts)
    except GenerationError as e:
        log.warning("Génération impossible : %s", e)
        raise HTTPException(status_code=502, detail="Le LLM n'a produit aucune question exploitable") from e


def _view(d: DocumentRow) -> DocumentView:
    return DocumentView(
        id=d.id,
        filename=d.filename,
        title=d.title,
        sizeBytes=d.size_bytes,
        pages=d.pages,
        chunks=d.chunks,
        status=d.status,
        progress=d.progress,
        error=d.error,
        createdAt=d.created_at.isoformat(),
    )


@app.get("/v1/documents", response_model=list[DocumentView], dependencies=[Depends(check_internal)])
def list_documents(teacher_id: str = Depends(teacher)) -> list[DocumentView]:
    return [_view(d) for d in rag_store().list(teacher_id)]


@app.post("/v1/documents", response_model=DocumentView, status_code=202, dependencies=[Depends(check_internal)])
def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    teacher_id: str = Depends(teacher),
) -> DocumentView:
    s = rag_store()
    data = file.file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise DocumentError(413, "FILE_TOO_LARGE", f"Fichier trop lourd : {settings.max_upload_mb} Mo maximum.")
    if not data.startswith(b"%PDF"):
        raise DocumentError(400, "NOT_A_PDF", "Ce fichier n'est pas un PDF.")
    doc = s.create(teacher_id, file.filename or "document.pdf", len(data))
    # Le découpage et les embeddings prennent quelques secondes : on répond tout de suite (202),
    # le frontend suit l'état du document (PROCESSING puis READY ou FAILED).
    background.add_task(s.ingest, doc.id, data)
    return _view(doc)


@app.delete("/v1/documents/{document_id}", status_code=204, dependencies=[Depends(check_internal)])
def delete_document(document_id: str, teacher_id: str = Depends(teacher)) -> None:
    rag_store().delete(teacher_id, document_id)


@app.post(
    "/v1/documents/{document_id}/questions",
    response_model=GenerateResponse,
    dependencies=[Depends(check_internal)],
)
def generate_from_doc(
    document_id: str, req: DocumentGenerateRequest, teacher_id: str = Depends(teacher)
) -> GenerateResponse:
    s = rag_store()
    doc = s.ready_document(teacher_id, document_id)
    try:
        return generate_from_document(s, llm, doc, req, max_attempts=settings.max_attempts)
    except (GenerationError, RagError) as e:
        log.warning("Génération depuis le document %s impossible : %s", document_id, e)
        raise HTTPException(status_code=502, detail="Le LLM n'a produit aucune question exploitable") from e
