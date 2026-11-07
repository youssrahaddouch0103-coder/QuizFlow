import { useState } from 'react'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { ActivityType, AiGeneratedQuestion } from '../../api/types'
import { ErrorAlert, Spinner } from '../../components/ui'
import './AiPanel.css'

type Source = 'text' | 'pdf'

/**
 * W7 — l'IA propose, l'enseignant décide : les questions générées s'affichent ici,
 * et ne rejoignent l'activité que si l'enseignant clique sur "Ajouter".
 */
export default function AiPanel({ type, onAdd }: { type: ActivityType; onAdd: (q: AiGeneratedQuestion[]) => void }) {
  const [source, setSource] = useState<Source>('text')
  const [text, setText] = useState('')
  const [count, setCount] = useState(3)
  const [difficulty, setDifficulty] = useState('moyen')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AiGeneratedQuestion[]>([])
  const [model, setModel] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.generateQuestions({ text, type, count, difficulty, language: 'fr' })
      setSuggestions(res.questions)
      setModel(res.model)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const accept = (items: AiGeneratedQuestion[]) => {
    onAdd(items)
    setSuggestions((s) => s.filter((q) => !items.includes(q)))
  }

  const length = text.trim().length
  const tooShort = length < 50
  const step = suggestions.length > 0 ? 2 : length > 0 ? 1 : 0

  return (
    <section className="ai-hero" aria-labelledby="ai-hero-title">
      <div className="ai-hero__grid">
        <div className="ai-hero__intro">
          <span className="ai-hero__chip">Assistant de questions</span>
          <h2 id="ai-hero-title" className="ai-hero__title">
            Votre cours devient un quiz en <span>30 secondes</span>.
          </h2>
          <p className="ai-hero__lead">
            Collez un passage de votre cours. Les questions s’appuient uniquement sur votre contenu, et vous gardez celles qui vous conviennent.
          </p>
          <ol className="ai-hero__steps">
            {['Ajoutez votre texte ou votre PDF', 'Relisez les questions proposées', 'Ajoutez celles que vous gardez'].map((label, i) => (
              <li key={label} className={i <= step ? 'is-active' : ''}>
                <span>{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>

        <div className="ai-hero__panel">
          <div className="ai-hero__tabs" role="tablist" aria-label="Source du contenu">
            <button type="button" role="tab" aria-selected={source === 'text'} className={source === 'text' ? 'is-selected' : ''} onClick={() => setSource('text')}>
              Coller un texte
            </button>
            <button type="button" role="tab" aria-selected={source === 'pdf'} className={source === 'pdf' ? 'is-selected' : ''} onClick={() => setSource('pdf')}>
              Importer un PDF <small>bientôt</small>
            </button>
          </div>

          {source === 'text' ? (
            <>
              <label className="ai-hero__field">
                <span className="sr-only">Votre texte</span>
                <textarea
                  className="textarea ai-hero__textarea"
                  maxLength={20000}
                  placeholder="Collez un extrait de cours, de formation ou de présentation…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <p className={`ai-hero__count ${tooShort ? '' : 'is-ready'}`}>
                {tooShort ? `${length} / 50 caractères minimum` : `${length} caractères · prêt à générer`}
              </p>
            </>
          ) : (
            <div className="ai-hero__dropzone">
              <strong>Import de PDF en préparation</strong>
              <span>Bientôt, déposez votre support de cours : l’IA retrouvera les passages utiles et citera les pages d’où viennent les questions.</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSource('text')}>
                Coller un texte en attendant
              </button>
            </div>
          )}

          <div className="ai-hero__options">
            <label>
              Nombre
              <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} question{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>
            {type === 'QUIZ' && (
              <label>
                Niveau
                <select className="select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="facile">Facile</option>
                  <option value="moyen">Moyen</option>
                  <option value="difficile">Difficile</option>
                </select>
              </label>
            )}
          </div>

          <button type="button" className="btn btn-accent ai-hero__generate" disabled={busy || tooShort || source !== 'text'} onClick={generate}>
            {busy ? (
              <>
                <Spinner /> L’IA lit votre cours…
              </>
            ) : (
              <>Générer les questions →</>
            )}
          </button>
          <ErrorAlert message={error} />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="ai-hero__results">
          <div className="ai-hero__results-head">
            <strong>{suggestions.length} proposition{suggestions.length > 1 ? 's' : ''} à relire</strong>
            <span className="spacer" />
            <button type="button" className="btn btn-accent btn-sm" onClick={() => accept(suggestions)}>
              Tout ajouter
            </button>
          </div>
          <div className="ai-hero__cards">
            {suggestions.map((q, i) => (
              <article key={i} className="ai-suggestion">
                <strong>{q.text}</strong>
                <ul>
                  {q.choices.map((c, j) => (
                    <li key={j} className={c.correct ? 'correct' : ''}>
                      <span className={`ai-letter c${j % 6}`}>{String.fromCharCode(65 + j)}</span>
                      {c.label}
                      {c.correct ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
                {q.explanation && <p className="muted small">Explication — {q.explanation}</p>}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => accept([q])}>
                  Ajouter
                </button>
              </article>
            ))}
          </div>
          {model && <p className="ai-hero__model">Modèle : {model}. Relisez toujours les questions avant de les utiliser.</p>}
        </div>
      )}
    </section>
  )
}
