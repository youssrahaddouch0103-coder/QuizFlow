import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { Activity, ActivityStatus, SessionSummary } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert, PageLoader, StateBadge } from '../../components/ui'
import ActivityCard from './ActivityCard'
import ActivitySymbol from '../../components/ActivitySymbol'
import DashboardEmptyState from './DashboardEmptyState'
import './DashboardPage.css'

type Filter = 'ALL' | ActivityStatus
type Sort = 'recent' | 'title'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'PRETE', label: 'Prêtes' },
  { key: 'BROUILLON', label: 'Brouillons' },
  { key: 'ARCHIVEE', label: 'Archivées' },
]

const titleOrder = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
const searchKey = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr')

export default function DashboardPage() {
  const navigate = useNavigate()
  const { teacher } = useAuth()
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [acts, sessions] = await Promise.all([api.listActivities(), api.listSessions('active')])
      setActivities(acts)
      setActiveSessions(sessions)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { ALL: 0, PRETE: 0, BROUILLON: 0, ARCHIVEE: 0 }
    for (const activity of activities ?? []) {
      result[activity.status] += 1
      if (activity.status !== 'ARCHIVEE') result.ALL += 1
    }
    return result
  }, [activities])

  const search = searchKey(query.trim())
  const visible = useMemo(() => {
    const matches = (activities ?? []).filter((activity) => {
      const inFilter = filter === 'ALL' ? activity.status !== 'ARCHIVEE' : activity.status === filter
      return inFilter && searchKey(activity.title || 'Sans titre').includes(search)
    })
    return matches.sort((a, b) => {
      const byTitle = titleOrder.compare(a.title || 'Sans titre', b.title || 'Sans titre')
      if (sort === 'title') return byTitle
      return ((Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)) || byTitle
    })
  }, [activities, filter, search, sort])

  const run = async (id: string, action: () => Promise<unknown>, confirmation: string) => {
    setBusyId(id)
    setError(null)
    setNotice('')
    try {
      await action()
      setNotice(confirmation)
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
    setNotice('')
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
    void run(a.id, () => api.deleteActivity(a.id), 'Activité supprimée.')
  }

  const onlyArchived = filter === 'ALL' && counts.ALL === 0 && counts.ARCHIVEE > 0

  return (
    <div className="stack dashboard-page">
      <header className="card dashboard-heading">
        <div>
          {teacher?.displayName.trim() && <p className="dashboard-greeting">Bonjour {teacher.displayName.trim()}</p>}
          <h1>Mes activités</h1>
          <p>Retrouvez vos activités ou choisissez ce que vous voulez créer.</p>
        </div>
        <div className="dashboard-create">
          <Link to="/activities/new?type=QUIZ" className="dashboard-create-link">
            <span className="dashboard-create-icon" aria-hidden="true">
              <ActivitySymbol kind="quiz" />
            </span>
            <span><strong>Nouveau quiz</strong><small>Testez les connaissances.</small></span>
            <span className="dashboard-create-arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/activities/new?type=SONDAGE" className="dashboard-create-link">
            <span className="dashboard-create-icon dashboard-create-icon--poll" aria-hidden="true">
              <ActivitySymbol kind="poll" />
            </span>
            <span><strong>Nouveau sondage</strong><small>Recueillez les avis.</small></span>
            <span className="dashboard-create-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <div aria-live="assertive"><ErrorAlert message={error} /></div>
      <div role="status">{notice && <p className="dashboard-notice">{notice}</p>}</div>
      {loadError && (
        <div className="card stack dashboard-load-error">
          <p role="alert">Impossible de charger vos activités. Vérifiez votre connexion, puis réessayez.</p>
          <button type="button" className="btn btn-outline" onClick={() => void load()} disabled={loading || busyId !== null}>
            Réessayer
          </button>
        </div>
      )}

      {activeSessions.length > 0 && (
        <div className="card stack dashboard-sessions">
          <h2>{activeSessions.length === 1 ? 'Session en cours' : 'Sessions en cours'}</h2>
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

      {activities && activities.length > 0 && (
        <section className="card dashboard-toolbar" aria-label="Rechercher et filtrer les activités">
          <div className="dashboard-toolbar-fields">
            <label className="dashboard-search">
              Rechercher par titre
              <input className="input" type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Ex. Quiz de révision" />
            </label>
            <label>
              Trier par
              <select className="select" value={sort} onChange={(event) => setSort(event.currentTarget.value === 'title' ? 'title' : 'recent')}>
                <option value="recent">Dernière modification</option>
                <option value="title">Titre (A à Z)</option>
              </select>
            </label>
          </div>
          <div className="dashboard-toolbar-bottom">
            <div className="tabs dashboard-filters" role="group" aria-label="Filtrer les activités">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  className={filter === f.key ? 'active' : ''}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="dashboard-filter-count">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <p className="muted small dashboard-result-count" role="status">
              {visible.length} {visible.length === 1 ? 'activité affichée' : 'activités affichées'}
            </p>
          </div>
        </section>
      )}

      {!activities && loading && <PageLoader />}
      {activities && visible.length === 0 && !loadError && (
        <DashboardEmptyState
          firstActivity={activities.length === 0}
          onlyArchived={onlyArchived}
          searching={counts[filter] > 0 && search !== ''}
          onChangeFilter={() => setFilter(onlyArchived ? 'ARCHIVEE' : 'ALL')}
          onClearSearch={() => setQuery('')}
        />
      )}
      {visible.length > 0 && (
        <div className="grid dashboard-grid">
          {visible.map((a) => {
            const busy = busyId !== null || loading
            return (
              <ActivityCard key={a.id} activity={a}>
                {a.status === 'PRETE' && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => launch(a)}>
                    Lancer
                  </button>
                )}
                {!a.locked && a.status !== 'ARCHIVEE' && (
                  <Link className="btn btn-outline btn-sm" to={`/activities/${a.id}/edit`}>
                    Modifier
                  </Link>
                )}
                {a.status === 'ARCHIVEE' && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(a.id, () => api.restoreActivity(a.id), 'Activité restaurée.')}>
                    Restaurer
                  </button>
                )}
                <details className="dashboard-card-more">
                  <summary className="btn btn-ghost btn-sm" aria-label={`Autres actions pour ${a.title || 'Sans titre'}`}>Autres actions</summary>
                  <div className="dashboard-card-options">
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(a.id, () => api.duplicateActivity(a.id), 'Activité dupliquée.')}>
                      Dupliquer
                    </button>
                    {a.status === 'PRETE' && (
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(a.id, () => api.archiveActivity(a.id), 'Activité archivée.')}>
                        Archiver
                      </button>
                    )}
                    {!a.locked && (
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(a)}>
                        Supprimer
                      </button>
                    )}
                  </div>
                </details>
              </ActivityCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
