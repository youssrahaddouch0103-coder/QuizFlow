import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert, Logo } from '../../components/ui'

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
    <div className="auth-page">
      <form className="card auth-card stack" onSubmit={submit}>
        <div className="brand">
          <Logo size={36} /> QuizFlow
        </div>
        <h2>Connexion enseignant</h2>
        <ErrorAlert message={error} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="muted small" style={{ textAlign: 'center' }}>
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          <br />
          Étudiant ? <Link to="/join">Rejoindre une session</Link>
        </p>
      </form>
    </div>
  )
}

export function RegisterPage() {
  const { teacher, register } = useAuth()
  const navigate = useNavigate()
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
      await register(email, password, displayName)
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card stack" onSubmit={submit}>
        <div className="brand">
          <Logo size={36} /> QuizFlow
        </div>
        <h2>Créer un compte enseignant</h2>
        <ErrorAlert message={error} />
        <div className="field">
          <label htmlFor="name">Nom affiché</label>
          <input id="name" className="input" required maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Pr. Alaoui" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe (8 caractères minimum)</label>
          <input id="password" className="input" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
        <p className="muted small" style={{ textAlign: 'center' }}>
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </form>
    </div>
  )
}
