import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { Activity, ActivityStatus, SessionSummary } from '../../api/types'
import { Empty, ErrorAlert, PageLoader, StateBadge, StatusBadge } from '../../components/ui'
import { formatDate, typeLabel } from '../../lib/format'

type Filter = 'ALL' | ActivityStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'PRETE', label: 'Prêtes' },
  { key: 'BROUILLON', label: 'Brouillons' },
  { key: 'ARCHIVEE', label: 'Archivées' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [acts, sessions] = await Promise.all([api.listActivities(), api.listSessions('active')])
      setActivities(acts)
      setActiveSessions(sessions)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!activities) return []
    if (filter === 'ALL') return activities.filter((a) => a.status !== 'ARCHIVEE')
    return activities.filter((a) => a.status === filter)
  }, [activities, filter])

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const launch = async (a: Activity) => {
    setBusyId(a.id)
    setError(null)
    try {
      const session = await api.launchSession(a.id)
      navigate(`/sessions/${session.id}/live`)
    } catch (e) {
      setError(errorMessage(e))
      setBusyId(null)
    }
  }

  const remove = (a: Activity) => {
    if (!window.confirm(`Supprimer définitivement « ${a.title || 'Sans titre'} » ?`)) return
    void run(a.id, () => api.deleteActivity(a.id))
  }

  if (!activities && !error) return <PageLoader />

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>Mes activités</h1>
          <p className="muted">Préparez vos quiz et sondages, puis lancez-les en classe en un clic.</p>
        </div>
        <div className="row">
          <Link to="/activities/new?type=SONDAGE" className="btn btn-outline">
            + Nouveau sondage
          </Link>
          <Link to="/activities/new?type=QUIZ" className="btn btn-primary">
            + Nouveau quiz
          </Link>
        </div>
      </div>

      <ErrorAlert message={error} />

      {activeSessions.length > 0 && (
        <div className="card stack" style={{ borderColor: '#c9c2ff', background: 'var(--primary-soft)' }}>
          <h3>Session en cours</h3>
          {activeSessions.map((s) => (
            <div key={s.id} className="row">
              <StateBadge state={s.state} />
              <strong>{s.activityTitle}</strong>
              <span className="muted">
                code <strong>{s.code}</strong> · {s.participantCount} participant(s)
              </span>
              <span className="spacer" />
              <Link className="btn btn-primary btn-sm" to={`/sessions/${s.id}/live`}>
                Reprendre
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty>
          <p style={{ fontSize: '2rem' }}>📝</p>
          <p>Aucune activité ici pour le moment.</p>
        </Empty>
      ) : (
        <div className="grid">
          {visible.map((a) => {
            const busy = busyId === a.id
            return (
              <div key={a.id} className="card activity-card">
                <div className="row">
                  <span className="badge badge-primary">{typeLabel[a.type]}</span>
                  <StatusBadge status={a.status} />
                  {a.locked && <span className="badge" title="Déjà jouée : dupliquez-la pour la modifier">🔒 Utilisée</span>}
                </div>
                <h3>{a.title || <span className="muted">Sans titre</span>}</h3>
                <p className="muted small">
                  {a.questionCount} question(s) · modifiée le {formatDate(a.updatedAt)}
                </p>
                {a.status === 'BROUILLON' && a.errors.length > 0 && <p className="small" style={{ color: 'var(--warning)' }}>⚠ {a.errors[0]}</p>}
                <div className="actions">
                  {a.status === 'PRETE' && (
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => launch(a)}>
                      ▶ Lancer
                    </button>
                  )}
                  {!a.locked && a.status !== 'ARCHIVEE' && (
                    <Link className="btn btn-outline btn-sm" to={`/activities/${a.id}/edit`}>
                      Modifier
                    </Link>
                  )}
                  <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(a.id, () => api.duplicateActivity(a.id))}>
                    Dupliquer
                  </button>
                  {a.status === 'PRETE' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(a.id, () => api.archiveActivity(a.id))}>
                      Archiver
                    </button>
                  )}
                  {a.status === 'ARCHIVEE' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(a.id, () => api.restoreActivity(a.id))}>
                      Restaurer
                    </button>
                  )}
                  {!a.locked && (
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(a)}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
