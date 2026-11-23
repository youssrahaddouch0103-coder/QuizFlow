import type { ActivityStatus, ActivityType, QuestionKind, SessionState } from '../api/types'

export const typeLabel: Record<ActivityType, string> = { QUIZ: 'Quiz', SONDAGE: 'Sondage' }

export const kindLabel: Record<QuestionKind, string> = {
  CHOIX: 'Choix',
  NUAGE: 'Nuage de mots',
  TEXTE: 'Texte libre',
  NOTE: 'Note',
  CLASSEMENT: 'Classement',
  QR: 'Questions du public',
  IDEES: 'Idées',
}

/** Le type utilise une liste de choix (réponses proposées ou éléments à classer). */
export const usesChoices = (kind?: QuestionKind) => !kind || kind === 'CHOIX' || kind === 'CLASSEMENT'

/** Les étudiants publient des contributions et votent. */
export const isContribution = (kind?: QuestionKind) => kind === 'QR' || kind === 'IDEES'

export const statusLabel: Record<ActivityStatus, string> = {
  BROUILLON: 'Brouillon',
  PRETE: 'Prête',
  ARCHIVEE: 'Archivée',
}

export const stateLabel: Record<SessionState, string> = {
  EN_ATTENTE: 'En attente',
  QUESTION_OUVERTE: 'Question ouverte',
  QUESTION_FERMEE: 'Question fermée',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function percent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((100 * count) / total)
}

/** Lettres affichées devant les choix (A, B, C...). */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
