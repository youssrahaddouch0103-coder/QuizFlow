import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { TeacherSessionView } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert, Logo, PageLoader } from '../../components/ui'
import { teams } from '../../lib/embed'
import ActivityPicker from './ActivityPicker'
import './Embed.css'

/**
 * Panneau QuizFlow dans une réunion Teams.
 *  - Enseignant connecté : lancer une activité, l'afficher sur l'écran de la réunion, piloter la session.
 *  - Sinon : un élève saisit le code (ou l'enseignant se connecte).
 */
export default function TeamsPage() {
  const { teacher, loading } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [session, setSession] = useState<TeacherSessionView | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState(false)

  if (loading) return <PageLoader />

  const join = (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c) navigate(`/join/${c}`)
  }

  if (!teacher) {
    return (
      <main className="embed embed--panel">
        <div className="embed-card">
          <div className="brand">
            <Logo size={30} /> QuizFlow
          </div>
          <form className="stack" onSubmit={join}>
            <label htmlFor="teams-code">Code de la session</label>
            <input id="teams-code" className="input embed-code" maxLength={6} autoComplete="off" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-primary" disabled={!code.trim()}>
              Rejoindre
            </button>
          </form>
          <Link className="small" to="/login?next=/teams">
            Enseignant ? Se connecter
          </Link>
        </div>
      </main>
    )
  }

  const launch = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      setSession(await api.launchSession(id))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  /** Affiche la page « Rejoindre » sur l'écran de la réunion : chaque participant répond depuis Teams. */
  const shareToStage = async (s: TeacherSessionView) => {
    setError(null)
    const sdk = await teams()
    if (!sdk) return setError('Disponible seulement dans une réunion Teams.')
    sdk.meeting.shareAppContentToStage((err) => {
      if (err) setError('Teams a refusé le partage. Ouvrez QuizFlow dans le panneau de la réunion, puis réessayez.')
      else setShared(true)
    }, `${window.location.origin}/join/${s.code}?host=teams`)
  }

  return (
    <main className="embed embed--panel">
      <div className="embed-card">
        <div className="brand">
          <Logo size={30} /> QuizFlow
        </div>
        <ErrorAlert message={error} />
        {session ? (
          <>
            <p className="muted small">Code de la session</p>
            <p className="embed-big-code">{session.code}</p>
            <button type="button" className="btn btn-primary" onClick={() => shareToStage(session)}>
              {shared ? 'Affiché pour tous ✓' : 'Afficher pour tous les participants'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate(`/sessions/${session.id}/live`)}>
              Piloter la session
            </button>
          </>
        ) : (
          <>
            <h1 className="embed-title">Lancer une activité</h1>
            <ActivityPicker action="Lancer" busyId={busyId} onPick={(a) => launch(a.id)} />
          </>
        )}
      </div>
    </main>
  )
}
