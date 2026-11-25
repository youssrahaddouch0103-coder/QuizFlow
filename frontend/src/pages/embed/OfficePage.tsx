import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { Activity } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert, Logo, PageLoader } from '../../components/ui'
import { office } from '../../lib/embed'
import ActivityPicker from './ActivityPicker'
import './Embed.css'

type Office = Awaited<ReturnType<typeof office>>
interface Linked {
  id: string
  title: string
}
const SETTING = 'quizflowActivity'

/**
 * Complément PowerPoint (inséré dans une diapositive).
 * En préparation : on choisit l'activité liée à la diapositive (enregistrée dans le fichier .pptx).
 * Pendant le diaporama : un clic sur « Lancer » ouvre l'écran de la session dans la diapositive.
 */
export default function OfficePage() {
  const { teacher, loading } = useAuth()
  const navigate = useNavigate()
  const [sdk, setSdk] = useState<Office | undefined>(undefined)
  const [linked, setLinked] = useState<Linked | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void office().then((o) => {
      setSdk(o)
      const saved = o?.context.document.settings.get(SETTING) as Linked | null | undefined
      if (saved?.id) setLinked(saved)
    })
  }, [])

  if (loading || sdk === undefined) return <PageLoader />

  if (!teacher) {
    return (
      <main className="embed">
        <div className="embed-card">
          <div className="brand">
            <Logo size={34} /> QuizFlow
          </div>
          <p>Connectez-vous pour relier un quiz à cette diapositive.</p>
          <Link className="btn btn-primary btn-lg" to="/login?next=/office">
            Se connecter
          </Link>
        </div>
      </main>
    )
  }

  const link = (a: Activity) => {
    const value = { id: a.id, title: a.title || 'Sans titre' }
    setLinked(value)
    setChoosing(false)
    if (sdk) {
      sdk.context.document.settings.set(SETTING, value)
      sdk.context.document.settings.saveAsync()
    }
  }

  const launch = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const session = await api.launchSession(id)
      navigate(`/sessions/${session.id}/live`)
    } catch (e) {
      setError(errorMessage(e))
      setBusyId(null)
    }
  }

  return (
    <main className="embed">
      <div className="embed-card">
        <div className="brand">
          <Logo size={34} /> QuizFlow
        </div>
        <ErrorAlert message={error} />
        {linked && !choosing ? (
          <>
            <h1 className="embed-title">{linked.title}</h1>
            <button type="button" className="btn btn-primary btn-lg" disabled={!!busyId} onClick={() => launch(linked.id)}>
              {busyId ? 'Lancement…' : 'Lancer la session'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChoosing(true)}>
              Changer d’activité
            </button>
          </>
        ) : (
          <>
            <h1 className="embed-title">Activité de cette diapositive</h1>
            <ActivityPicker action="Choisir" onPick={link} />
            {!sdk && <p className="muted small">Hors de PowerPoint, le choix n’est pas enregistré.</p>}
          </>
        )}
      </div>
    </main>
  )
}
