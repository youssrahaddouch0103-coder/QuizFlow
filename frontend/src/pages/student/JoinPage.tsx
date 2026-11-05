import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { ApiError, errorMessage } from '../../api/client'
import type { PublicSessionInfo } from '../../api/types'
import { ErrorAlert, Logo, Spinner } from '../../components/ui'
import { playerStore } from '../../lib/playerStore'
import { typeLabel } from '../../lib/format'

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
    <div className="auth-page">
      <div className="card auth-card stack">
        <div className="brand">
          <Logo size={36} /> QuizFlow
        </div>

        {checking && (
          <div className="player-center" style={{ padding: 20 }}>
            <Spinner />
          </div>
        )}

        {!checking && !info && (
          <form className="stack" onSubmit={submitCode}>
            <h2 style={{ textAlign: 'center' }}>Rejoindre une session</h2>
            <ErrorAlert message={error} />
            <input
              className="input code-input"
              inputMode="text"
              autoComplete="off"
              autoFocus
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
