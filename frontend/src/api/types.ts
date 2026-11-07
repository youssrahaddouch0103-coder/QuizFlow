// Types partagés avec le backend : ils reflètent exactement les DTO Java (voir docs/CONTRAT.md).

export type ActivityType = 'QUIZ' | 'SONDAGE'
export type ActivityStatus = 'BROUILLON' | 'PRETE' | 'ARCHIVEE'
export type ChoiceMode = 'UNIQUE' | 'MULTIPLE'
export type SessionState = 'EN_ATTENTE' | 'QUESTION_OUVERTE' | 'QUESTION_FERMEE' | 'TERMINEE' | 'ANNULEE'

export interface Teacher {
  id: number
  email: string
  displayName: string
}

export interface AuthResponse {
  token: string
  teacher: Teacher
}

// ---------- Activités ----------

export interface Choice {
  id?: string
  position?: number
  label: string
  correct: boolean
}

export interface Question {
  id?: string
  position?: number
  text: string
  choiceMode: ChoiceMode
  choices: Choice[]
}

export interface Activity {
  id: string
  type: ActivityType
  title: string | null
  description: string | null
  status: ActivityStatus
  locked: boolean
  errors: string[]
  questions: Question[]
  questionCount: number
  createdAt: string
  updatedAt: string
}

export interface ActivityRequest {
  type: ActivityType
  title: string
  description: string
  questions: Question[]
}

// ---------- Sessions ----------

export interface ChoiceLive {
  id: string
  label: string
}

export interface QuestionLive {
  id: string
  index: number
  total: number
  text: string
  choiceMode: ChoiceMode
  choices: ChoiceLive[]
  /** Minuteur choisi par l'enseignant (absent = sans minuteur) */
  durationSeconds?: number
  /** Temps restant au moment de l'envoi par le serveur */
  remainingMs?: number
}

export interface ClosedInfo {
  questionId: string
  correctChoiceIds: string[]
  distribution: Record<string, number>
  answerCount: number
}

export interface LiveStats {
  questionId: string
  answerCount: number
  participantCount: number
  distribution: Record<string, number>
}

export interface SessionSummary {
  id: string
  code: string
  state: SessionState
  activityId: string
  activityTitle: string
  activityType: ActivityType
  questionCount: number
  participantCount: number
  createdAt: string
  endedAt?: string
}

export interface TeacherSessionView {
  id: string
  code: string
  state: SessionState
  activityId: string
  activityTitle: string
  activityType: ActivityType
  questionCount: number
  currentIndex?: number
  currentQuestion?: QuestionLive
  closed?: ClosedInfo
  stats?: LiveStats
  participantCount: number
  participants: string[]
  createdAt: string
  startedAt?: string
  endedAt?: string
}

export interface LeaderboardEntry {
  pseudo: string
  score: number
  rank: number
}

export interface ChoiceResult {
  id: string
  label: string
  correct: boolean
  count: number
  percent: number
}

export interface QuestionResult {
  id: string
  position: number
  text: string
  choiceMode?: ChoiceMode
  answerCount: number
  successRate?: number
  choices: ChoiceResult[]
}

export interface ResultsView {
  session: SessionSummary
  leaderboard: LeaderboardEntry[]
  questions: QuestionResult[]
}

// ---------- Étudiant ----------

export interface PublicSessionInfo {
  code: string
  title: string
  type: ActivityType
  state: SessionState
}

export interface JoinResponse {
  participantId: string
  pseudo: string
  token: string
}

export interface MyResult {
  score: number
  rank: number
  participantCount: number
  questionCount: number
}

export interface PlayerState {
  code: string
  title: string
  type: ActivityType
  state: SessionState
  pseudo: string
  question?: QuestionLive
  answered: boolean
  myChoiceIds: string[]
  closed?: ClosedInfo
  myAnswerCorrect?: boolean
  result?: MyResult
}

// ---------- IA ----------

export interface AiGenerateRequest {
  text: string
  type: ActivityType
  count: number
  language?: string
  difficulty?: string
}

/** Origine d'une question générée depuis un PDF : pages et extrait du cours. */
export interface AiQuestionSource {
  documentId?: string
  documentName?: string
  pages: number[]
  excerpt?: string
  score?: number
}

export interface AiGeneratedQuestion {
  text: string
  choiceMode: ChoiceMode
  choices: { label: string; correct: boolean }[]
  explanation?: string
  source?: AiQuestionSource
}

export interface AiGenerateResponse {
  questions: AiGeneratedQuestion[]
  model: string
}

// ---------- Bibliothèque de documents (RAG) ----------

export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED'

export interface CourseDocument {
  id: string
  filename: string
  title?: string
  sizeBytes: number
  pages: number
  chunks: number
  status: DocumentStatus
  /** 0 à 100 pendant l'analyse */
  progress?: number
  error?: string
  createdAt: string
}

export interface DocumentGenerateRequest {
  topic?: string
  type: ActivityType
  count: number
  language?: string
  difficulty?: string
}

// ---------- Temps réel ----------

export type LiveEventType =
  | 'QUESTION_OPENED'
  | 'QUESTION_CLOSED'
  | 'SESSION_ENDED'
  | 'SESSION_CANCELLED'
  | 'PARTICIPANT_JOINED'
  | 'ANSWER_STATS'
  | 'SESSION_RESULTS'

export interface LiveEvent<T = unknown> {
  type: LiveEventType
  payload: T
  at: string
}

export interface ParticipantJoinedPayload {
  pseudo: string
  participantCount: number
}
