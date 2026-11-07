export interface PendingRegistration {
  challengeId: string
  expiresAt: string
  resendAvailableAt: string
  message: string
}

const key = 'quizflow.pending-registration'
export function readPending(): PendingRegistration | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    return value && typeof value.challengeId === 'string' &&
      Number.isFinite(Date.parse(value.expiresAt)) && Number.isFinite(Date.parse(value.resendAvailableAt)) ? value : null
  } catch { return null }
}
export function storePending(value: PendingRegistration | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  } catch { /* The current page still works when browser storage is unavailable. */ }
}
