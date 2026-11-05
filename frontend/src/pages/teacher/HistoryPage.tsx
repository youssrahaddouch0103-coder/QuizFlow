import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { SessionSummary } from '../../api/types'
import { Empty, ErrorAlert, PageLoader, StateBadge } from '../../components/ui'
import { formatDate, typeLabel } from '../../lib/format'

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listSessions().then(setSessions).catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <ErrorAlert message={error} />
  if (!sessions) return <PageLoader />

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>Historique des sessions</h1>
          <p className="muted">Retrouvez les résultats de vos séances passées.</p>
        </div>
      </div>
      {sessions.length === 0 ? (
        <Empty>
          <p style={{ fontSize: '2rem' }}>🕓</p>
          <p>Aucune session pour le moment. Lancez une activité depuis le tableau de bord.</p>
        </Empty>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Activité</th>
                <th>Type</th>
                <th>Date</th>
                <th>Participants</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.activityTitle}</strong>
                    <div className="muted small">code {s.code}</div>
                  </td>
                  <td>{typeLabel[s.activityType]}</td>
                  <td>{formatDate(s.createdAt)}</td>
                  <td>{s.participantCount}</td>
                  <td>
                    <StateBadge state={s.state} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {s.state === 'TERMINEE' && (
                      <Link className="btn btn-outline btn-sm" to={`/sessions/${s.id}/results`}>
                        Résultats
                      </Link>
                    )}
                    {['EN_ATTENTE', 'QUESTION_OUVERTE', 'QUESTION_FERMEE'].includes(s.state) && (
                      <Link className="btn btn-primary btn-sm" to={`/sessions/${s.id}/live`}>
                        Reprendre
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
