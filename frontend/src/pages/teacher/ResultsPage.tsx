import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { ResultsView } from '../../api/types'
import { ErrorAlert, PageLoader, ResultBars } from '../../components/ui'
import { KindResults } from '../../components/KindResults'
import { formatDate, typeLabel } from '../../lib/format'

/** Détail d'une session terminée : statistiques par question et classement (W6). */
export default function ResultsPage() {
  const { id } = useParams()
  const [results, setResults] = useState<ResultsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.sessionResults(id).then(setResults).catch((e) => setError(errorMessage(e)))
  }, [id])

  if (error) return <ErrorAlert message={error} />
  if (!results) return <PageLoader />

  const { session, leaderboard, questions } = results
  const quiz = session.activityType === 'QUIZ'
  // Seules les questions à choix sont notées.
  // Seules les questions avec une bonne réponse sont notées (elles ont un taux de réussite).
  const graded = questions.filter((q) => q.successRate !== undefined && q.successRate !== null)

  const exportCsv = () => {
    const lines = [['Rang', 'Pseudo', 'Score'], ...leaderboard.map((e) => [e.rank, e.pseudo, e.score])]
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `resultats-${session.code}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 6 }}>
          <Link to="/history" className="small">
            ← Historique
          </Link>
          <h1>{session.activityTitle}</h1>
          <p className="muted">
            {typeLabel[session.activityType]} · code {session.code} · {formatDate(session.endedAt ?? session.createdAt)}
          </p>
        </div>
        {quiz && leaderboard.length > 0 && (
          <button className="btn btn-outline" onClick={exportCsv}>
            Exporter le classement (CSV)
          </button>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="value">{session.participantCount}</div>
          <div className="label">participants</div>
        </div>
        <div className="kpi">
          <div className="value">{questions.length}</div>
          <div className="label">questions</div>
        </div>
        {quiz && (
          <div className="kpi">
            <div className="value">
              {graded.length === 0 ? 0 : Math.round((100 * graded.reduce((s, q) => s + (q.successRate ?? 0), 0)) / graded.length)}%
            </div>
            <div className="label">de bonnes réponses en moyenne</div>
          </div>
        )}
      </div>

      {questions.map((q) => (
        <div key={q.id} className="card stack">
          <div className="row">
            <span className="badge badge-primary">Question {q.position}</span>
            <span className="muted small">
              {q.answerCount} {q.kind === 'QR' ? 'question(s)' : q.kind === 'IDEES' ? 'idée(s)' : 'réponse(s)'}
            </span>
            {quiz && q.successRate !== undefined && q.successRate !== null && (
              <span className={`badge ${q.successRate >= 0.5 ? 'badge-success' : 'badge-danger'}`}>{Math.round(q.successRate * 100)}% de réussite</span>
            )}
          </div>
          <h2>{q.text}</h2>
          {(q.kind ?? 'CHOIX') === 'CHOIX' ? (
            <ResultBars items={q.choices.map((c) => ({ id: c.id, label: c.label, count: c.count, correct: c.correct }))} total={q.answerCount} revealCorrect={q.choices.some((c) => c.correct)} />
          ) : (
            <KindResults kind={q.kind!} data={q} />
          )}
        </div>
      ))}

      {quiz && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Classement</h2>
          {leaderboard.length === 0 ? (
            <p className="muted">Aucun participant.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Pseudo</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((e) => (
                  <tr key={e.pseudo}>
                    <td>{e.rank}</td>
                    <td>{e.pseudo}</td>
                    <td>
                      {e.score} / {graded.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
