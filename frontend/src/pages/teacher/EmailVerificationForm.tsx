import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { storePending, type PendingRegistration } from '../../auth/pendingRegistration'
import { ErrorAlert, Logo } from '../../components/ui'
import AuthPageLayout from './AuthPageLayout'

export default function EmailVerificationForm({ pending, onUpdate, onRestart }: {
  pending: PendingRegistration
  onUpdate: (value: PendingRegistration) => void
  onRestart: () => void
}) {
  const { verifyEmail } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const wait = Math.max(0, Math.ceil((Date.parse(pending.resendAvailableAt) - now) / 1000))
  const expired = now >= Date.parse(pending.expiresAt)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setNotice('')
    try {
      await verifyEmail(pending.challengeId, code)
      navigate('/dashboard', { replace: true })
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function resend() {
    setBusy(true); setError(null); setNotice('')
    try {
      const next = await api.resendEmail(pending.challengeId)
      storePending(next); onUpdate(next); setCode('')
      setNotice('Si votre inscription est en attente, un nouveau code vous a été envoyé. Utilisez le dernier code reçu.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <AuthPageLayout mode="register">
    <form className="card auth-card stack qf-auth__form" onSubmit={submit} aria-busy={busy}>
      <div className="brand"><Logo size={36} /> QuizFlow</div>
      <h1>Confirmez votre email</h1>
      <p className="muted">Saisissez le code à 6 chiffres reçu par email. Pensez à vérifier les courriers indésirables.</p>
      <div aria-live="polite"><ErrorAlert message={error} />{notice && <p>{notice}</p>}</div>
      <div className="field">
        <label htmlFor="verification-code">Code de confirmation</label>
        <input id="verification-code" className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} aria-describedby="verification-help" />
      </div>
      <p id="verification-help" className="muted small">{expired ? 'Le code a expiré. Demandez un nouveau code.' : 'Le code est personnel et ne peut être utilisé qu’une fois.'}</p>
      <button className="btn btn-primary btn-block" disabled={busy || expired || code.length !== 6}>{busy ? 'Veuillez patienter…' : 'Confirmer mon email'}</button>
      <button type="button" className="btn btn-outline" disabled={busy || wait > 0} onClick={() => void resend()}>{wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer un code'}</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={onRestart}>Utiliser une autre adresse</button>
      <p className="muted small">Déjà inscrit ? <Link to="/login">Se connecter</Link></p>
    </form>
  </AuthPageLayout>
}
