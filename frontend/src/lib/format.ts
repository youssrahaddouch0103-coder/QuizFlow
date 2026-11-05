import type { ActivityStatus, ActivityType, SessionState } from '../api/types'

export const typeLabel: Record<ActivityType, string> = { QUIZ: 'Quiz', SONDAGE: 'Sondage' }

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
