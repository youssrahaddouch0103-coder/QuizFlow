import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert, Logo } from '../../components/ui'
import AuthPageLayout from './AuthPageLayout'
import AuthField from './AuthField'
import PasswordInput from './PasswordInput'
import './AuthPages.css'
import { readPending, storePending } from '../../auth/pendingRegistration'
import EmailVerificationForm from './EmailVerificationForm'
import GoogleAuthButton from './GoogleAuthButton'

export function LoginPage() {
  const { teacher, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (teacher) return <Navigate to="/dashboard" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPageLayout mode="login">
      <form className="card auth-card stack qf-auth__form" onSubmit={submit} aria-busy={busy}>
        <div className="brand">
          <Logo size={36} /> QuizFlow
        </div>
        <h1>Connexion enseignant</h1>
        <div className="qf-auth__feedback" aria-live="polite" aria-atomic="true">
          <ErrorAlert message={error} />
        </div>
        <AuthField icon="email">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <AuthField icon="lock">
          <label htmlFor="password">Mot de passe</label>
          <PasswordInput id="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </AuthField>
        <Link className="small" to="/forgot-password">Mot de passe oublié ?</Link>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <GoogleAuthButton disabled={busy} />
        <p className="muted small" style={{ textAlign: 'center' }}>
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          <br />
          Étudiant ? <Link to="/join">Rejoindre une session</Link>
        </p>
      </form>
    </AuthPageLayout>
  )
}

export function RegisterPage() {
  const { teacher, register } = useAuth()
  const [pending, setPending] = useState(readPending)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (teacher) return <Navigate to="/dashboard" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await register(email, password, displayName)
      setPassword('')
      setPending(response)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (pending) return <EmailVerificationForm pending={pending} onUpdate={setPending} onRestart={() => { storePending(null); setPending(null) }} />

  return (
    <AuthPageLayout mode="register">
      <form className="card auth-card stack qf-auth__form" onSubmit={submit} aria-busy={busy}>
        <div className="brand">
          <Logo size={36} /> QuizFlow
        </div>
        <h1>Créer un compte enseignant</h1>
        <div className="qf-auth__feedback" aria-live="polite" aria-atomic="true">
          <ErrorAlert message={error} />
        </div>
        <AuthField icon="user">
          <label htmlFor="name">Nom affiché</label>
          <input id="name" className="input" required maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Pr. Zemmouri" />
        </AuthField>
        <AuthField icon="email">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <AuthField icon="lock">
          <label htmlFor="password">Mot de passe (8 caractères minimum)</label>
          <PasswordInput id="password" className="input" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </AuthField>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
        <GoogleAuthButton disabled={busy} />
        <p className="muted small" style={{ textAlign: 'center' }}>
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </form>
    </AuthPageLayout>
  )
}
