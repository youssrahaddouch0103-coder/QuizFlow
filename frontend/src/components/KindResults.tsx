import type { ContributionView, QuestionKind, RankItem, RatingStats, WordCount } from '../api/types'
import './KindResults.css'

/** Résultats d'une question qui n'est pas à choix : nuage de mots, textes, note, classement, contributions. */
export interface KindData {
  words?: WordCount[] | null
  texts?: string[] | null
  rating?: RatingStats | null
  ranking?: RankItem[] | null
  contributions?: ContributionView[] | null
}

export function KindResults({ kind, data, onModerate }: {
  kind: QuestionKind
  data: KindData
  /** Écran de l'enseignant : marquer une contribution comme traitée, ou la masquer. */
  onModerate?: (id: string, change: { done?: boolean; hidden?: boolean }) => void
}) {
  switch (kind) {
    case 'NUAGE':
      return <WordCloud words={data.words ?? []} />
    case 'TEXTE':
      return <TextList texts={data.texts ?? []} />
    case 'NOTE':
      return <RatingView rating={data.rating} />
    case 'CLASSEMENT':
      return <RankingView ranking={data.ranking ?? []} />
    case 'QR':
    case 'IDEES':
      return <ContributionList items={data.contributions ?? []} onModerate={onModerate} />
    default:
      return null
  }
}

const empty = <p className="kind-empty">Aucune réponse pour le moment.</p>

function WordCloud({ words }: { words: WordCount[] }) {
  if (words.length === 0) return <div className="kind-card">{empty}</div>
  const max = Math.max(...words.map((w) => w.count))
  // Ordre alterné (gros mots au centre) pour un nuage plus équilibré.
  const shown = words.slice(0, 60)
  const arranged = shown.map((_, i) => shown[i % 2 === 0 ? i / 2 : shown.length - 1 - (i - 1) / 2])
  return (
    <div className="kind-card word-cloud" aria-label="Nuage de mots">
      {arranged.map((w, i) => {
        const size = 0.95 + 2.1 * (w.count / max)
        return (
          <span key={w.text} className="word-cloud__word" style={{ fontSize: `${size}rem`, color: `var(--c${i % 6})` }} title={`${w.count} réponse(s)`}>
            {w.text}
          </span>
        )
      })}
    </div>
  )
}

function TextList({ texts }: { texts: string[] }) {
  if (texts.length === 0) return <div className="kind-card">{empty}</div>
  return (
    <ul className="kind-texts">
      {texts.map((t, i) => (
        <li key={`${i}-${t}`}>{t}</li>
      ))}
    </ul>
  )
}

function RatingView({ rating }: { rating?: RatingStats | null }) {
  const dist = rating?.distribution ?? {}
  const counts = [5, 4, 3, 2, 1].map((v) => ({ v, n: Number(dist[String(v)] ?? 0) }))
  const total = counts.reduce((a, b) => a + b.n, 0)
  const avg = rating?.average
  return (
    <div className="kind-card rating-view">
      <div className="rating-view__avg">
        <strong>{avg === null || avg === undefined ? '–' : avg.toFixed(1).replace('.', ',')}</strong>
        <span aria-hidden="true">★</span>
        <small>sur 5</small>
      </div>
      <div className="rating-view__bars">
        {counts.map(({ v, n }) => (
          <div key={v} className="rating-view__row">
            <span>{v} ★</span>
            <div className="rating-view__track">
              <div style={{ width: `${total ? (100 * n) / total : 0}%` }} />
            </div>
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingView({ ranking }: { ranking: RankItem[] }) {
  return (
    <ol className="kind-ranking">
      {ranking.map((r, i) => (
        <li key={r.choiceId}>
          <span className="kind-ranking__pos">{i + 1}</span>
          <span className="kind-ranking__label">{r.label}</span>
          <small>{r.averagePosition === null || r.averagePosition === undefined ? '–' : `position moyenne ${r.averagePosition.toFixed(1).replace('.', ',')}`}</small>
        </li>
      ))}
    </ol>
  )
}

function ContributionList({ items, onModerate }: { items: ContributionView[]; onModerate?: KindResultsModerate }) {
  if (items.length === 0) return <div className="kind-card">{empty}</div>
  return (
    <ul className="kind-contributions">
      {items.map((c) => (
        <li key={c.id} className={`${c.done ? 'is-done' : ''} ${c.hidden ? 'is-hidden' : ''}`}>
          <span className="kind-contributions__votes">▲ {c.votes}</span>
          <span className="kind-contributions__text">{c.text}</span>
          {onModerate && (
            <span className="kind-contributions__actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => onModerate(c.id, { done: !c.done })}>
                {c.done ? 'Rouvrir' : 'Traitée'}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onModerate(c.id, { hidden: !c.hidden })}>
                {c.hidden ? 'Afficher' : 'Masquer'}
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

type KindResultsModerate = (id: string, change: { done?: boolean; hidden?: boolean }) => void
