import { Navigate, Route, Routes } from 'react-router-dom'
import TeacherLayout from './components/TeacherLayout'
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

function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { teacher, loading } = useAuth()
  if (loading) return <PageLoader />
  return teacher ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
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

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
