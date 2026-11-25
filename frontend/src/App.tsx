import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import TeacherLayout from './components/TeacherLayout'
import LandingPage from './pages/LandingPage'
import JoinPage from './pages/student/JoinPage'
import PlayPage from './pages/student/PlayPage'
import ActivityEditorPage from './pages/teacher/ActivityEditorPage'
import { LoginPage, RegisterPage } from './pages/teacher/AuthPages'
import PasswordResetPage from './pages/teacher/PasswordResetPage'
import DashboardPage from './pages/teacher/DashboardPage'
import HistoryPage from './pages/teacher/HistoryPage'
import LiveSessionPage from './pages/teacher/LiveSessionPage'
import ResultsPage from './pages/teacher/ResultsPage'
import { useAuth } from './auth/AuthContext'
import { PageLoader } from './components/ui'

// Pages pour PowerPoint et Teams : chargées seulement quand on les ouvre.
const OfficePage = lazy(() => import('./pages/embed/OfficePage'))
const TeamsPage = lazy(() => import('./pages/embed/TeamsPage'))
const TeamsConfigPage = lazy(() => import('./pages/embed/TeamsConfigPage'))

function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { teacher, loading } = useAuth()
  if (loading) return <PageLoader />
  return teacher ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Page d'accueil publique */}
      <Route path="/" element={<LandingPage />} />

      {/* Étudiants (sans compte) */}
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/play/:code" element={<PlayPage />} />

      {/* Enseignants */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<PasswordResetPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/sessions/:id/live"
        element={
          <RequireTeacher>
            <LiveSessionPage />
          </RequireTeacher>
        }
      />
      <Route element={<TeacherLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/activities/new" element={<ActivityEditorPage />} />
        <Route path="/activities/:id/edit" element={<ActivityEditorPage />} />
        <Route path="/sessions/:id/results" element={<ResultsPage />} />
      </Route>

      {/* Microsoft : complément PowerPoint et application Teams */}
      <Route path="/office" element={<Suspense fallback={<PageLoader />}><OfficePage /></Suspense>} />
      <Route path="/teams" element={<Suspense fallback={<PageLoader />}><TeamsPage /></Suspense>} />
      <Route path="/teams/config" element={<Suspense fallback={<PageLoader />}><TeamsConfigPage /></Suspense>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
