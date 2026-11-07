import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, request } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert, Logo } from '../../components/ui'
import AuthPageLayout from './AuthPageLayout'
import PasswordInput from './PasswordInput'
import './AuthPages.css'

export default function PasswordResetPage() {
  const { logout } = useAuth()
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function sendCode() {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      await request<void>('/api/auth/password/forgot', {
        method: 'POST', body: { email: email.trim() }, auth: false,
      })
      setCode('')
      setStep('reset')
      setNotice('Si un compte est associé à cette adresse, vous recevrez un code par email. Le dernier code reçu est valable 10 minutes.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 'email') {
      await sendCode()
      return
    }
    if (step !== 'reset' || busy) return
    if (password !== confirmation) {
      setError('Les deux mots de passe doivent être identiques.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await request<void>('/api/auth/password/reset', {
        method: 'POST', body: { email: email.trim(), code, password }, auth: false,
      })
      logout()
      setPassword('')
      setConfirmation('')
      setCode('')
      setStep('done')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const title = step === 'email' ? 'Mot de passe oublié' :
    step === 'reset' ? 'Choisissez un nouveau mot de passe' : 'Mot de passe modifié'

  return (
    <AuthPageLayout mode="login">
      <form className="card auth-card stack qf-auth__form" onSubmit={submit} aria-busy={busy}>
        <div className="brand"><Logo size={36} /> QuizFlow</div>
        <h1>{title}</h1>
        <div className="qf-auth__feedback" aria-live="polite" aria-atomic="true">
          <ErrorAlert message={error} />
        </div>
        {step === 'email' && (
          <div className="field">
            <label htmlFor="reset-email">Adresse email du compte</label>
            <input id="reset-email" className="input" type="email" autoComplete="email"
              maxLength={255} required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        )}
        {step === 'reset' && (
          <>
            <p className="muted small" role="status">{notice}</p>
            <div className="field">
              <label htmlFor="reset-code">Code à 6 chiffres</label>
              <input id="reset-code" className="input" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code}
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <div className="field">
              <label htmlFor="new-password">Nouveau mot de passe (8 caractères minimum)</label>
              <PasswordInput id="new-password" className="input" autoComplete="new-password"
                minLength={8} maxLength={100} required disabled={busy} value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirmez le nouveau mot de passe</label>
              <PasswordInput id="confirm-password" className="input" autoComplete="new-password"
                minLength={8} maxLength={100} required disabled={busy} value={confirmation}
                onChange={e => setConfirmation(e.target.value)} />
            </div>
          </>
        )}
        {step !== 'done' && (
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Veuillez patienter…' : step === 'email' ? 'Envoyer un code' : 'Changer mon mot de passe'}
          </button>
        )}
        {step === 'reset' && (
          <>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void sendCode()}>
              Demander un nouveau code
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => {
              setCode('')
              setPassword('')
              setConfirmation('')
              setError(null)
              setStep('email')
            }}>Modifier l’adresse email</button>
          </>
        )}
        {step === 'done' && <p role="status">Vous pouvez vous connecter avec votre nouveau mot de passe.</p>}
        <Link to="/login">{step === 'done' ? 'Se connecter' : 'Retour à la connexion'}</Link>
      </form>
    </AuthPageLayout>
  )
}
