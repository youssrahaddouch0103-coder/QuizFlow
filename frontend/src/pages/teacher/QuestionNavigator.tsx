import type { QuestionKind } from '../../api/types'
import { kindLabel, usesChoices } from '../../lib/format'

type QuestionSummary = { uid: string; text: string; kind: QuestionKind; choices: { label: string }[] }

export default function QuestionNavigator({ questions, selected, onSelect, onAdd, readOnly }: {
  questions: QuestionSummary[]
  selected?: string
  onSelect: (id: string) => void
  onAdd: () => void
  readOnly: boolean
}) {
  return <nav className="question-navigator" aria-label="Questions de l’activité">
    <div className="question-nav-heading"><strong>Questions</strong><span>{questions.length}</span></div>
    {!readOnly && <button className="btn btn-primary" onClick={onAdd}>+ Ajouter une question</button>}
    <ol>
      {questions.map((q, index) => <li key={q.uid}>
        <button className="question-thumbnail" aria-current={q.uid === selected ? 'step' : undefined} onClick={() => onSelect(q.uid)}>
          <span className="question-thumbnail-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="question-thumbnail-title">{q.text.trim() || 'Nouvelle question'}</span>
          {usesChoices(q.kind) && <span className="question-thumbnail-answers" aria-hidden="true">{q.choices.map((_, i) => <i key={i} />)}</span>}
          <span className="question-thumbnail-caption">
            {q.kind === 'CHOIX' ? `${q.choices.length} choix` : q.kind === 'CLASSEMENT' ? `Classement · ${q.choices.length} éléments` : kindLabel[q.kind]}
          </span>
        </button>
      </li>)}
    </ol>
  </nav>
}
