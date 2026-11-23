import { useState } from 'react'
import type { ChoiceLive, ContributionView, QuestionKind } from '../../api/types'

/** Nuage de mots (un mot ou une courte expression) et texte libre. */
export function TextAnswer({ kind, disabled, sending, onSubmit }: {
  kind: QuestionKind
  disabled: boolean
  sending: boolean
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')
  const cloud = kind === 'NUAGE'
  const ready = text.trim().length > 0
  return (
    <form
      className="stack"
      style={{ gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) onSubmit(text.trim())
      }}
    >
      {cloud ? (
        <input className="input player-text-input" maxLength={40} placeholder="Votre mot" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} aria-label="Votre mot" />
      ) : (
        <textarea className="textarea player-text-input" maxLength={500} rows={4} placeholder="Votre réponse" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} aria-label="Votre réponse" />
      )}
      <button className="btn btn-accent btn-lg btn-block" disabled={!ready || disabled || sending}>
        {disabled ? 'Temps écoulé' : sending ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  )
}

/** Note de 1 à 5 étoiles. */
export function RatingAnswer({ disabled, sending, onSubmit }: { disabled: boolean; sending: boolean; onSubmit: (value: number) => void }) {
  const [value, setValue] = useState(0)
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="player-stars" role="radiogroup" aria-label="Votre note">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={`${v} sur 5`}
            className={`player-star ${v <= value ? 'on' : ''}`}
            disabled={disabled}
            onClick={() => setValue(v)}
          >
            ★
          </button>
        ))}
      </div>
      <button className="btn btn-accent btn-lg btn-block" disabled={value === 0 || disabled || sending} onClick={() => onSubmit(value)}>
        {disabled ? 'Temps écoulé' : sending ? 'Envoi…' : 'Valider ma note'}
      </button>
    </div>
  )
}

/** Classement : l'étudiant ordonne les éléments avec les flèches. */
export function RankingAnswer({ choices, disabled, sending, onSubmit }: {
  choices: ChoiceLive[]
  disabled: boolean
  sending: boolean
  onSubmit: (order: string[]) => void
}) {
  const [order, setOrder] = useState(() => choices.map((c) => c.id))
  const label = (id: string) => choices.find((c) => c.id === id)?.label ?? ''
  const move = (i: number, delta: number) =>
    setOrder((o) => {
      const next = [...o]
      const j = i + delta
      if (j < 0 || j >= next.length) return o
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  return (
    <div className="stack" style={{ gap: 10 }}>
      <ol className="player-ranking">
        {order.map((id, i) => (
          <li key={id}>
            <span className="player-ranking__pos">{i + 1}</span>
            <span className="player-ranking__label">{label(id)}</span>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Monter ${label(id)}`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Descendre ${label(id)}`} disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button className="btn btn-accent btn-lg btn-block" disabled={disabled || sending} onClick={() => onSubmit(order)}>
        {disabled ? 'Temps écoulé' : sending ? 'Envoi…' : 'Valider mon classement'}
      </button>
    </div>
  )
}

/** Questions du public et idées : publier, puis voter pour les contributions des autres. */
export function ContributionBoard({ kind, contributions, myVotes, mine, open, sending, onPost, onVote }: {
  kind: QuestionKind
  contributions: ContributionView[]
  myVotes: string[]
  mine: string[]
  open: boolean
  sending: boolean
  onPost: (text: string) => Promise<boolean>
  onVote: (id: string) => void
}) {
  const [text, setText] = useState('')
  const qa = kind === 'QR'
  return (
    <div className="stack" style={{ gap: 12 }}>
      {open && (
        <form
          className="player-post"
          onSubmit={async (e) => {
            e.preventDefault()
            if (text.trim() && (await onPost(text.trim()))) setText('')
          }}
        >
          <textarea
            className="textarea"
            rows={2}
            maxLength={300}
            placeholder={qa ? 'Votre question' : 'Votre idée'}
            aria-label={qa ? 'Votre question' : 'Votre idée'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-accent" disabled={!text.trim() || sending}>
            {sending ? 'Envoi…' : 'Publier'}
          </button>
        </form>
      )}
      <ul className="player-contributions">
        {contributions.map((c) => {
          const own = mine.includes(c.id)
          const voted = myVotes.includes(c.id)
          return (
            <li key={c.id} className={c.done ? 'is-done' : ''}>
              <span className="player-contributions__text">{c.text}</span>
              <button
                type="button"
                className={`player-vote ${voted ? 'on' : ''}`}
                aria-pressed={voted}
                aria-label={own ? `${c.votes} vote(s)` : voted ? 'Retirer mon vote' : 'Voter'}
                disabled={!open || own}
                onClick={() => onVote(c.id)}
              >
                ▲ {c.votes}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
