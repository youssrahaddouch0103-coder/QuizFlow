import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { ApiError, errorMessage } from '../../api/client'
import type { PublicSessionInfo } from '../../api/types'
import { ErrorAlert, Logo, Spinner } from '../../components/ui'
import { playerStore } from '../../lib/playerStore'
import { typeLabel } from '../../lib/format'
import './JoinPage.css'

// Le lecteur de QR (jsQR) n'est chargé que si l'élève choisit de scanner.
const QrScanner = lazy(() => import('./QrScanner'))
const Hero3D = lazy(() => import('../Hero3D'))

/** W4 : l'étudiant saisit le code (ou arrive par le QR code), puis choisit un pseudo. */
export default function JoinPage() {
  const { code: codeParam } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(codeParam?.toUpperCase() ?? '')
  const [info, setInfo] = useState<PublicSessionInfo | null>(null)
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(!!codeParam)
  const [scanning, setScanning] = useState(false)

  const onScanned = useCallback(
    (c: string) => {
      setScanning(false)
      setCode(c)
      navigate(`/join/${c}`)
    },
    [navigate],
  )
  const closeScanner = useCallback(() => setScanning(false), [])

  // Arrivée par le QR code : on vérifie la session, et on reconnecte si l'étudiant y est déjà.
  useEffect(() => {
    if (!codeParam) return
    const c = codeParam.toUpperCase()
    const run = async () => {
      try {
        const identity = playerStore.get(c)
        if (identity) {
          try {
            await api.playerState(c, identity.token)
            navigate(`/play/${c}`, { replace: true })
            return
          } catch {
            playerStore.clear(c)
          }
        }
        setInfo(await api.sessionInfo(c))
      } catch (e) {
        setError(e instanceof ApiError && e.status === 404 ? 'Aucune session en cours avec ce code.' : errorMessage(e))
      } finally {
        setChecking(false)
      }
    }
    void run()
  }, [codeParam, navigate])

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c.length === 6) navigate(`/join/${c}`)
  }

  const submitPseudo = async (e: FormEvent) => {
    e.preventDefault()
    if (!info) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.join(info.code, pseudo)
      playerStore.set(info.code, res)
      navigate(`/play/${info.code}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page join-page">
      <div className="join-page__bg" aria-hidden="true">
        <Suspense fallback={null}>
          <Hero3D variant="full" />
        </Suspense>
        <span className="join-page__shade" />
      </div>
      <Link to="/" className="join-page__back">
        ← Accueil
      </Link>
      <div className="card auth-card stack">
        <div className="brand">
          <Logo size={36} /> QuizFlow
        </div>

        {checking && (
          <div className="player-center" style={{ padding: 20 }}>
            <Spinner />
          </div>
        )}

        {!checking && !info && scanning && (
          <div className="stack">
            <h2 style={{ textAlign: 'center' }}>Scanner le QR code</h2>
            <Suspense fallback={<div className="player-center" style={{ padding: 20 }}><Spinner /></div>}>
              <QrScanner onCode={onScanned} onClose={closeScanner} />
            </Suspense>
          </div>
        )}

        {!checking && !info && !scanning && (
          <form className="stack" onSubmit={submitCode}>
            <h2 style={{ textAlign: 'center' }}>Rejoindre une session</h2>
            <ErrorAlert message={error} />
            <button type="button" className="btn btn-accent btn-lg btn-block join-scan-btn" onClick={() => setScanning(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
                <path d="M9 9h2v2H9zM13 13h2v2h-2zM13 9h2M9 15h2" />
              </svg>
              Scanner le QR code
            </button>
            <div className="join-or">ou saisissez le code</div>
            <input
              className="input code-input"
              inputMode="text"
              autoComplete="off"
              aria-label="Code de la session"
              maxLength={6}
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button className="btn btn-primary btn-lg btn-block" disabled={code.length !== 6}>
              Continuer
            </button>
          </form>
        )}

        {!checking && info && (
          <form className="stack" onSubmit={submitPseudo}>
            <div style={{ textAlign: 'center' }} className="stack">
              <span className="badge badge-primary" style={{ alignSelf: 'center' }}>
                {typeLabel[info.type]} · {info.code}
              </span>
              <h2>{info.title}</h2>
            </div>
            <ErrorAlert message={error} />
            <div className="field">
              <label htmlFor="pseudo">Votre pseudo</label>
              <input id="pseudo" className="input" autoFocus required maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ex. Youssra" />
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !pseudo.trim()}>
              {busy ? 'Connexion…' : 'Rejoindre'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
