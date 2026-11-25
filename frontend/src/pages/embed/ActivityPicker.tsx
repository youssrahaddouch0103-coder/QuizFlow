import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { Activity } from '../../api/types'
import { ErrorAlert, Spinner } from '../../components/ui'
import { typeLabel } from '../../lib/format'

/** Liste des activités prêtes à être lancées, avec un bouton par activité. */
export default function ActivityPicker({ action, busyId, onPick }: {
  action: string
  busyId?: string | null
  onPick: (activity: Activity) => void
}) {
  const [items, setItems] = useState<Activity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listActivities('PRETE')
      .then(setItems)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <ErrorAlert message={error} />
  if (!items) return <Spinner />
  if (items.length === 0) return <p className="muted">Aucune activité prête. Terminez un quiz ou un sondage dans QuizFlow, puis revenez ici.</p>

  return (
    <ul className="embed-list">
      {items.map((a) => (
        <li key={a.id}>
          <span>
            <strong>{a.title || 'Sans titre'}</strong>
            <small className="muted">
              {typeLabel[a.type]} · {a.questions.length} question{a.questions.length > 1 ? 's' : ''}
            </small>
          </span>
          <button type="button" className="btn btn-primary btn-sm" disabled={!!busyId} onClick={() => onPick(a)}>
            {busyId === a.id ? '…' : action}
          </button>
        </li>
      ))}
    </ul>
  )
}
