import type { ChoiceMode, QuestionKind } from '../api/types'

/** Un type proposé dans l'éditeur : le choix unique et le choix multiple sont deux options du type CHOIX. */
export interface TypeOption {
  value: string
  kind: QuestionKind
  mode: ChoiceMode
  label: string
}

export const TYPE_OPTIONS: TypeOption[] = [
  { value: 'CHOIX:UNIQUE', kind: 'CHOIX', mode: 'UNIQUE', label: 'Choix unique' },
  { value: 'CHOIX:MULTIPLE', kind: 'CHOIX', mode: 'MULTIPLE', label: 'Choix multiple' },
  { value: 'NUAGE', kind: 'NUAGE', mode: 'UNIQUE', label: 'Nuage de mots' },
  { value: 'TEXTE', kind: 'TEXTE', mode: 'UNIQUE', label: 'Texte libre' },
  { value: 'NOTE', kind: 'NOTE', mode: 'UNIQUE', label: 'Note de 1 à 5' },
  { value: 'CLASSEMENT', kind: 'CLASSEMENT', mode: 'UNIQUE', label: 'Classement' },
  { value: 'QR', kind: 'QR', mode: 'UNIQUE', label: 'Questions du public' },
  { value: 'IDEES', kind: 'IDEES', mode: 'UNIQUE', label: 'Idées' },
]

/** Un quiz ne contient que des questions à choix (notées). Les autres types sont réservés aux sondages. */
export const QUIZ_TYPES = TYPE_OPTIONS.filter((o) => o.kind === 'CHOIX')

export const typeValue = (kind: QuestionKind, mode: ChoiceMode) => (kind === 'CHOIX' ? `CHOIX:${mode}` : kind)
export const typeOption = (value: string) => TYPE_OPTIONS.find((o) => o.value === value) ?? TYPE_OPTIONS[0]
