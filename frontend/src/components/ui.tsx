import type { ReactNode } from 'react'
import type { ActivityStatus, SessionState } from '../api/types'
import type { ConnectionStatus } from '../realtime/useSessionChannel'
import { LETTERS, stateLabel, statusLabel } from '../lib/format'

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <path d="M9 21V11l7 5 7-5v10" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Chargement" />
}

export function PageLoader() {
  return (
    <div className="center-page">
      <Spinner />
    </div>
  )
}

export function ErrorAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return <div className="alert alert-error">{message}</div>
}

export function StatusBadge({ status }: { status: ActivityStatus }) {
  const cls = status === 'PRETE' ? 'badge-success' : status === 'BROUILLON' ? 'badge-warning' : ''
  return <span className={`badge ${cls}`}>{statusLabel[status]}</span>
}

export function StateBadge({ state }: { state: SessionState }) {
  const cls =
    state === 'TERMINEE' ? 'badge-success' : state === 'ANNULEE' ? 'badge-danger' : state === 'EN_ATTENTE' ? 'badge-warning' : 'badge-primary'
  return <span className={`badge ${cls}`}>{stateLabel[state]}</span>
}

export function ChoiceLetter({ index }: { index: number }) {
  return (
    <span className="choice-letter" style={{ background: `var(--c${index % 6})` }}>
      {LETTERS[index] ?? index + 1}
    </span>
  )
}

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const label = status === 'connected' ? 'En direct' : status === 'connecting' ? 'Connexion…' : 'Reconnexion…'
  return (
    <span className={`conn ${status}`}>
      <span className="dot" /> {label}
    </span>
  )
}

export interface BarItem {
  id: string
  label: string
  count: number
  correct?: boolean
}

/** Barres de résultats (écran projeté, résultats, écran étudiant). */
export function ResultBars({ items, total, revealCorrect }: { items: BarItem[]; total: number; revealCorrect?: boolean }) {
  return (
    <div className="bars">
      {items.map((item, i) => {
        const pct = total === 0 ? 0 : Math.round((100 * item.count) / total)
        const cls = revealCorrect ? (item.correct ? 'correct' : 'dim') : ''
        return (
          <div key={item.id} className={`bar-row ${cls}`}>
            <ChoiceLetter index={i} />
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: `var(--c${i % 6})` }} />
              <div className="bar-label">
                {item.label}
                {revealCorrect && item.correct && <span className="badge badge-success">Bonne réponse</span>}
              </div>
            </div>
            <div className="bar-value">
              {pct}%<small>{item.count} rép.</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card empty">{children}</div>
}
