import { request } from './client'
import type { PendingRegistration } from '../auth/pendingRegistration'
import type {
  Activity,
  ActivityRequest,
  ActivityStatus,
  AiGenerateRequest,
  AiGenerateResponse,
  AuthResponse,
  ContributionView,
  CourseDocument,
  DocumentGenerateRequest,
  JoinResponse,
  LiveStats,
  PlayerState,
  PublicSessionInfo,
  ResultsView,
  SessionSummary,
  Teacher,
  TeacherSessionView,
} from './types'

const PLAYER_HEADER = 'X-Participant-Token'

/** Réponse d'un étudiant selon le type de question. */
export type AnswerPayload = { choiceIds?: string[]; text?: string; value?: number }

export const api = {
  // Authentification
  register: (email: string, password: string, displayName: string) =>
    request<PendingRegistration>('/api/auth/register', { method: 'POST', body: { email, password, displayName }, auth: false }),
  verifyEmail: (challengeId: string, code: string) =>
    request<AuthResponse>('/api/auth/email/verify', { method: 'POST', body: { challengeId, code }, auth: false }),
  resendEmail: (challengeId: string) =>
    request<PendingRegistration>('/api/auth/email/resend', { method: 'POST', body: { challengeId }, auth: false }),
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

  // Bibliothèque de PDF (RAG)
  listDocuments: () => request<CourseDocument[]>('/api/documents'),
  uploadDocument: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<CourseDocument>('/api/documents', { method: 'POST', body: form })
  },
  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: 'DELETE' }),
  generateFromDocument: (id: string, body: DocumentGenerateRequest) =>
    request<AiGenerateResponse>(`/api/documents/${id}/questions`, { method: 'POST', body }),

  // Sessions (enseignant)
  listSessions: (scope?: 'active' | 'finished') =>
    request<SessionSummary[]>('/api/sessions' + (scope ? `?scope=${scope}` : '')),
  launchSession: (activityId: string) => request<TeacherSessionView>('/api/sessions', { method: 'POST', body: { activityId } }),
  getSession: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}`),
  startSession: (id: string, durationSeconds?: number) =>
    request<TeacherSessionView>(`/api/sessions/${id}/start`, { method: 'POST', body: durationSeconds ? { durationSeconds } : undefined }),
  closeQuestion: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}/questions/close`, { method: 'POST' }),
  nextQuestion: (id: string, durationSeconds?: number) =>
    request<TeacherSessionView>(`/api/sessions/${id}/questions/next`, { method: 'POST', body: durationSeconds ? { durationSeconds } : undefined }),
  endSession: (id: string) => request<ResultsView>(`/api/sessions/${id}/end`, { method: 'POST' }),
  cancelSession: (id: string) => request<TeacherSessionView>(`/api/sessions/${id}/cancel`, { method: 'POST' }),
  sessionResults: (id: string) => request<ResultsView>(`/api/sessions/${id}/results`),
  moderate: (id: string, contributionId: string, change: { done?: boolean; hidden?: boolean }) =>
    request<LiveStats>(`/api/sessions/${id}/contributions/${contributionId}`, { method: 'POST', body: change }),

  // Public (étudiants)
  publicConfig: () => request<{ publicUrl: string }>('/api/public/config', { auth: false }),
  sessionInfo: (code: string) => request<PublicSessionInfo>(`/api/public/sessions/${code}`, { auth: false }),
  join: (code: string, pseudo: string) =>
    request<JoinResponse>(`/api/public/sessions/${code}/join`, { method: 'POST', body: { pseudo }, auth: false }),
  playerState: (code: string, token: string) =>
    request<PlayerState>(`/api/public/sessions/${code}/state`, { headers: { [PLAYER_HEADER]: token }, auth: false }),
  answer: (code: string, token: string, questionId: string, answer: AnswerPayload) =>
    request<{ accepted: boolean }>(`/api/public/sessions/${code}/answers`, {
      method: 'POST',
      body: { questionId, ...answer },
      headers: { [PLAYER_HEADER]: token },
      auth: false,
    }),
  contribute: (code: string, token: string, questionId: string, text: string) =>
    request<ContributionView>(`/api/public/sessions/${code}/contributions`, {
      method: 'POST',
      body: { questionId, text },
      headers: { [PLAYER_HEADER]: token },
      auth: false,
    }),
  vote: (code: string, token: string, contributionId: string) =>
    request<{ voted: boolean }>(`/api/public/sessions/${code}/contributions/${contributionId}/vote`, {
      method: 'POST',
      headers: { [PLAYER_HEADER]: token },
      auth: false,
    }),
}
