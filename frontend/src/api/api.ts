import { request } from './client'
import type {
  Activity,
  ActivityRequest,
  ActivityStatus,
  AiGenerateRequest,
  AiGenerateResponse,
  AuthResponse,
  JoinResponse,
  PlayerState,
  PublicSessionInfo,
  ResultsView,
  SessionSummary,
  Teacher,
  TeacherSessionView,
} from './types'

const PLAYER_HEADER = 'X-Participant-Token'

export const api = {
  // Authentification
  register: (email: string, password: string, displayName: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: { email, password, displayName }, auth: false }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request<Teacher>('/api/auth/me'),

  // Activités
  listActivities: (status?: ActivityStatus) =>
    request<Activity[]>('/api/activities' + (status ? `?status=${status}` : '')),
  getActivity: (id: string) => request<Activity>(`/api/activities/${id}`),
  createActivity: (body: ActivityRequest) => request<Activity>('/api/activities', { method: 'POST', body }),
  updateActivity: (id: string, body: ActivityRequest) => request<Activity>(`/api/activities/${id}`, { method: 'PUT', body }),
  deleteActivity: (id: string) => request<void>(`/api/activities/${id}`, { method: 'DELETE' }),
  duplicateActivity: (id: string) => request<Activity>(`/api/activities/${id}/duplicate`, { method: 'POST' }),
  archiveActivity: (id: string) => request<Activity>(`/api/activities/${id}/archive`, { method: 'POST' }),
  restoreActivity: (id: string) => request<Activity>(`/api/activities/${id}/restore`, { method: 'POST' }),

  // IA
  generateQuestions: (body: AiGenerateRequest) => request<AiGenerateResponse>('/api/ai/questions', { method: 'POST', body }),

  // Sessions (enseignant)
  listSessions: (scope?: 'active' | 'finished') =>
    request<SessionSummary[]>('/api/sessions' + (scope ? `?scope=${scope}` : '')),
  launchSession: (activityId: string) => request<TeacherSessionView>('/api/sessions', { method: 'POST', body: { activityId } }),
  getSession: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}`),
  startSession: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}/start`, { method: 'POST' }),
  closeQuestion: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}/questions/close`, { method: 'POST' }),
  nextQuestion: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}/questions/next`, { method: 'POST' }),
  endSession: (id: string) => request<ResultsView>(`/api/sessions/${id}/end`, { method: 'POST' }),
  cancelSession: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}/cancel`, { method: 'POST' }),
  sessionResults: (id: string) => request<ResultsView>(`/api/sessions/${id}/results`),

  // Public (étudiants)
  publicConfig: () => request<{ publicUrl: string }>('/api/public/config', { auth: false }),
  sessionInfo: (code: string) => request<PublicSessionInfo>(`/api/public/sessions/${code}`, { auth: false }),
  join: (code: string, pseudo: string) =>
    request<JoinResponse>(`/api/public/sessions/${code}/join`, { method: 'POST', body: { pseudo }, auth: false }),
  playerState: (code: string, token: string) =>
    request<PlayerState>(`/api/public/sessions/${code}/state`, { headers: { [PLAYER_HEADER]: token }, auth: false }),
  answer: (code: string, token: string, questionId: string, choiceIds: string[]) =>
    request<{ accepted: boolean }>(`/api/public/sessions/${code}/answers`, {
      method: 'POST',
      body: { questionId, choiceIds },
      headers: { [PLAYER_HEADER]: token },
      auth: false,
    }),
}
