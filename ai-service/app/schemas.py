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


class GeneratedQuestion(BaseModel):
    text: str
    choiceMode: ChoiceMode = ChoiceMode.UNIQUE
    choices: list[GeneratedChoice]
    explanation: str | None = None


class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestion]
    model: str
