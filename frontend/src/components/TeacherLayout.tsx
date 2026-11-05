import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo, PageLoader } from './ui'

/** Gabarit des pages enseignant : vérifie la connexion et affiche la barre de navigation. */
export default function TeacherLayout() {
  const { teacher, loading, logout } = useAuth()
  if (loading) return <PageLoader />
  if (!teacher) return <Navigate to="/login" replace />

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/dashboard" className="brand">
            <Logo /> QuizFlow
          </NavLink>
          <nav className="nav">
            <NavLink to="/dashboard">Activités</NavLink>
            <NavLink to="/history">Historique</NavLink>
          </nav>
          <div className="user-menu">
            <span className="muted">{teacher.displayName}</span>
            <button className="btn btn-outline btn-sm" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
