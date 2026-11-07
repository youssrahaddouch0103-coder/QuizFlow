"""Contrat d'entrée/sortie du service IA (identique aux DTO Java AiDtos)."""

from enum import Enum

from pydantic import BaseModel, Field


class ActivityType(str, Enum):
    QUIZ = "QUIZ"
    SONDAGE = "SONDAGE"


class ChoiceMode(str, Enum):
    UNIQUE = "UNIQUE"
    MULTIPLE = "MULTIPLE"


class GenerateRequest(BaseModel):
    text: str = Field(min_length=50, max_length=20000, description="Extrait de cours")
    type: ActivityType = ActivityType.QUIZ
    count: int = Field(default=3, ge=1, le=10)
    language: str = "fr"
    difficulty: str = "moyen"


class GeneratedChoice(BaseModel):
    label: str
    correct: bool = False


class QuestionSource(BaseModel):
    """D'où vient la question dans le document importé (RAG)."""

    documentId: str | None = None
    documentName: str | None = None
    pages: list[int] = Field(default_factory=list)
    excerpt: str | None = None
    score: float | None = Field(default=None, description="Similarité entre la question et le passage (0 à 1)")


class GeneratedQuestion(BaseModel):
    text: str
    choiceMode: ChoiceMode = ChoiceMode.UNIQUE
    choices: list[GeneratedChoice]
    explanation: str | None = None
    source: QuestionSource | None = None


class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestion]
    model: str


# ---------- Documents (RAG) ----------


class DocumentStatus(str, Enum):
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class DocumentView(BaseModel):
    id: str
    filename: str
    title: str | None = None
    sizeBytes: int
    pages: int
    chunks: int
    status: DocumentStatus
    progress: int = 0
    error: str | None = None
    createdAt: str


class DocumentGenerateRequest(BaseModel):
    """Génération à partir d'un document de la bibliothèque. Sans sujet, on couvre tout le document."""

    topic: str | None = Field(default=None, max_length=200, description="Chapitre ou notion à cibler (facultatif)")
    type: ActivityType = ActivityType.QUIZ
    count: int = Field(default=3, ge=1, le=10)
    language: str = "fr"
    difficulty: str = "moyen"
