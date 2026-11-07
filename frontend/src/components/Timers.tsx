import { useEffect, useState } from 'react'
import './Timers.css'

/** Anneau de compte à rebours : vert, puis orange à 10 s, puis rouge à 5 s. */
export function CountdownRing({ seconds, total, size = 64 }: { seconds: number; total: number; size?: number }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const ratio = total > 0 ? Math.min(1, seconds / total) : 0
  const level = seconds <= 5 ? 'is-urgent' : seconds <= 10 ? 'is-warning' : ''
  return (
    <div className={`countdown ${level}`} style={{ width: size, height: size }} role="timer" aria-live="off" aria-label={`${seconds} secondes restantes`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="countdown__track" />
        <circle cx="32" cy="32" r={r} className="countdown__arc" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} />
      </svg>
      <span>{seconds}</span>
    </div>
  )
}

function format(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Chronomètre de la session : temps écoulé depuis la première question (figé à la fin). */
export function SessionClock({ startedAt, endedAt }: { startedAt?: string; endedAt?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt || endedAt) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [startedAt, endedAt])
  if (!startedAt) return null
  const end = endedAt ? new Date(endedAt).getTime() : now
  const elapsed = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000))
  return (
    <span className="session-clock" title="Temps écoulé depuis le début de la session">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
      {format(elapsed)}
    </span>
  )
}
