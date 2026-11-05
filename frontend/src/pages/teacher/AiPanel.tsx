import { useState } from 'react'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { ActivityType, AiGeneratedQuestion } from '../../api/types'
import { ErrorAlert, Spinner } from '../../components/ui'

/**
 * W7 — l'IA propose, l'enseignant décide : les questions générées s'affichent ici,
 * et ne rejoignent l'activité que si l'enseignant clique sur "Ajouter".
 */
export default function AiPanel({ type, onAdd }: { type: ActivityType; onAdd: (q: AiGeneratedQuestion[]) => void }) {
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

  const tooShort = text.trim().length < 50

  return (
    <div className="card ai-panel stack">
      <div className="row">
        <span style={{ fontSize: '1.3rem' }}>✨</span>
        <h3>Générer avec l’IA</h3>
      </div>
      <p className="muted small">Collez la partie du cours que vous venez d’expliquer : l’IA propose des questions basées uniquement sur ce texte.</p>
      <textarea className="textarea" style={{ minHeight: 130 }} maxLength={20000} placeholder="Extrait de cours (50 caractères minimum)…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <select className="select" style={{ width: 'auto' }} value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} question{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
        {type === 'QUIZ' && (
          <select className="select" style={{ width: 'auto' }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="facile">Facile</option>
            <option value="moyen">Moyen</option>
            <option value="difficile">Difficile</option>
          </select>
        )}
      </div>
      <button className="btn btn-primary" disabled={busy || tooShort} onClick={generate}>
        {busy ? 'Génération…' : 'Générer des questions'}
      </button>
      {busy && (
        <div className="row muted small">
          <Spinner /> L’IA lit votre cours…
        </div>
      )}
      <ErrorAlert message={error} />

      {suggestions.length > 0 && (
        <div className="stack">
          <div className="row">
            <strong>{suggestions.length} proposition(s)</strong>
            <span className="spacer" />
            <button className="btn btn-outline btn-sm" onClick={() => accept(suggestions)}>
              Tout ajouter
            </button>
          </div>
          {suggestions.map((q, i) => (
            <div key={i} className="ai-suggestion small">
              <strong>{q.text}</strong>
              <ul>
                {q.choices.map((c, j) => (
                  <li key={j} className={c.correct ? 'correct' : ''}>
                    {c.label}
                    {c.correct ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
              {q.explanation && <p className="muted">💡 {q.explanation}</p>}
              <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => accept([q])}>
                Ajouter
              </button>
            </div>
          ))}
          {model && <p className="muted small">Modèle : {model}. Relisez toujours les questions avant de les utiliser.</p>}
        </div>
      )}
    </div>
  )
}
