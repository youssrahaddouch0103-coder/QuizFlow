import { useEffect, useState } from 'react'
import { LETTERS } from '../../lib/format'
import './QuizShowcase.css'

type Example = {
  kind: 'Quiz' | 'Sondage'
  subject: string
  question: string
  choices: { label: string; pct: number; correct?: boolean }[]
  participants: number
}

/** Exemples d'activités qui défilent dans la bannière du tableau de bord (purement décoratif). */
const EXAMPLES: Example[] = [
  {
    kind: 'Quiz',
    subject: 'SVT · 3e',
    question: 'Quel gaz les plantes rejettent-elles pendant la photosynthèse ?',
    choices: [
      { label: 'Dioxyde de carbone', pct: 18 },
      { label: 'Oxygène', pct: 71, correct: true },
      { label: 'Azote', pct: 8 },
      { label: 'Hydrogène', pct: 3 },
    ],
    participants: 28,
  },
  {
    kind: 'Sondage',
    subject: 'Fin de séance',
    question: 'Comment avez-vous trouvé le cours d’aujourd’hui ?',
    choices: [
      { label: 'Très clair', pct: 46 },
      { label: 'Plutôt clair', pct: 38 },
      { label: 'À revoir', pct: 16 },
    ],
    participants: 34,
  },
  {
    kind: 'Quiz',
    subject: 'Python · Bac+1',
    question: 'Que renvoie len([3, 7, 1]) ?',
    choices: [
      { label: '2', pct: 9 },
      { label: '3', pct: 82, correct: true },
      { label: '7', pct: 6 },
      { label: 'Une erreur', pct: 3 },
    ],
    participants: 41,
  },
  {
    kind: 'Quiz',
    subject: 'Histoire · 4e',
    question: 'En quelle année a eu lieu la prise de la Bastille ?',
    choices: [
      { label: '1789', pct: 64, correct: true },
      { label: '1792', pct: 21 },
      { label: '1815', pct: 15 },
    ],
    participants: 25,
  },
]

const DELAY = 4500

export default function QuizShowcase() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (paused || reduce) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % EXAMPLES.length), DELAY)
    return () => window.clearTimeout(t)
  }, [index, paused])

  const ex = EXAMPLES[index]
  const next = EXAMPLES[(index + 1) % EXAMPLES.length]

  return (
    <div
      className="showcase"
      aria-label="Exemples d’activités"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="showcase-stage">
        <div className="showcase-card showcase-card--back" aria-hidden="true">
          <span className="showcase-chip">{next.kind}</span>
          <p className="showcase-question">{next.question}</p>
        </div>

        <article key={index} className="showcase-card showcase-card--front">
          <div className="showcase-top">
            <span className={`showcase-chip ${ex.kind === 'Sondage' ? 'is-poll' : ''}`}>{ex.kind}</span>
            <span className="showcase-subject">{ex.subject}</span>
            <span className="spacer" />
            <span className="showcase-live">
              <i /> En direct
            </span>
          </div>
          <p className="showcase-question">{ex.question}</p>
          <ul className="showcase-bars">
            {ex.choices.map((c, i) => (
              <li key={c.label} className={c.correct ? 'is-correct' : ''}>
                <span className="showcase-letter" style={{ background: `var(--c${i % 6})` }}>
                  {LETTERS[i]}
                </span>
                <span className="showcase-track">
                  <span className="showcase-fill" style={{ width: `${c.pct}%`, background: `var(--c${i % 6})`, animationDelay: `${150 + i * 120}ms` }} />
                  <span className="showcase-label">
                    {c.label}
                    {c.correct && ' ✓'}
                  </span>
                </span>
                <span className="showcase-pct">{c.pct}%</span>
              </li>
            ))}
          </ul>
          <div className="showcase-foot">
            <span>{ex.participants} participants</span>
            <span className="showcase-code">Code 482 913</span>
          </div>
        </article>
      </div>

      <div className="showcase-dots">
        {EXAMPLES.map((e, i) => (
          <button key={i} type="button" aria-label={`Exemple ${i + 1} : ${e.subject}`} aria-current={i === index} className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)} />
        ))}
      </div>
    </div>
  )
}
