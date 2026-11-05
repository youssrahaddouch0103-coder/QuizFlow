import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage, tokenStore } from '../../api/client'
import type { LiveEvent, LiveStats, ParticipantJoinedPayload, ResultsView, TeacherSessionView } from '../../api/types'
import { ConnectionIndicator, ErrorAlert, Logo, PageLoader, ResultBars, StateBadge } from '../../components/ui'
import { useSessionChannel } from '../../realtime/useSessionChannel'

/** Écran projeté par l'enseignant pendant le cours (W3 à W6). */
export default function LiveSessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [view, setView] = useState<TeacherSessionView | null>(null)
  const [results, setResults] = useState<ResultsView | null>(null)
  const [publicUrl, setPublicUrl] = useState<string>(window.location.origin)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showLive, setShowLive] = useState(true)

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const v = await api.getSession(id)
      setView(v)
      if (v.state === 'TERMINEE') setResults(await api.sessionResults(id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [id])

  useEffect(() => {
    void reload()
    api
      .publicConfig()
      .then((c) => c.publicUrl && setPublicUrl(c.publicUrl.replace(/\/$/, '')))
      .catch(() => undefined)
  }, [reload])

  const active = view && ['EN_ATTENTE', 'QUESTION_OUVERTE', 'QUESTION_FERMEE'].includes(view.state)

  const onEvent = useCallback(
    (event: LiveEvent) => {
      switch (event.type) {
        case 'PARTICIPANT_JOINED': {
          const p = event.payload as ParticipantJoinedPayload
          setView((v) => {
            if (!v) return v
            const participants = v.participants.includes(p.pseudo) ? v.participants : [...v.participants, p.pseudo]
            // Plusieurs arrivées simultanées : on garde le plus grand des deux comptages.
            return { ...v, participants, participantCount: Math.max(p.participantCount, participants.length) }
          })
          break
        }
        case 'ANSWER_STATS': {
          const s = event.payload as LiveStats
          setView((v) => (v && v.currentQuestion?.id === s.questionId ? { ...v, stats: s } : v))
          break
        }
        case 'SESSION_RESULTS':
          setResults(event.payload as ResultsView)
          break
        case 'SESSION_CANCELLED':
          navigate('/dashboard')
          break
        default:
          break
      }
    },
    [navigate],
  )

  const status = useSessionChannel({
    code: active ? view?.code : undefined,
    teacherToken: tokenStore.get(),
    onEvent,
    onConnected: reload,
  })

  const act = async (fn: () => Promise<TeacherSessionView | ResultsView>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if ('leaderboard' in res) {
        setResults(res)
        setView((v) => (v ? { ...v, state: 'TERMINEE' } : v))
      } else {
        setView(res)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!view) return error ? <div className="container"><ErrorAlert message={error} /></div> : <PageLoader />

  const joinUrl = `${publicUrl}/join/${view.code}`
  const displayHost = joinUrl.replace(/^https?:\/\//, '').replace(`/join/${view.code}`, '/join')
  const isLast = view.currentIndex !== undefined && view.currentIndex + 1 >= view.questionCount
  const q = view.currentQuestion
  const closed = view.state === 'QUESTION_FERMEE'
  const distribution = (closed ? view.closed?.distribution : view.stats?.distribution) ?? {}
  const answerCount = (closed ? view.closed?.answerCount : view.stats?.answerCount) ?? 0
  const correctIds = view.closed?.correctChoiceIds ?? []

  return (
    <div className="presenter">
      <div className="presenter-bar">
        <Link to="/dashboard" className="brand">
          <Logo /> QuizFlow
        </Link>
        <strong className="muted">{view.activityTitle}</strong>
        <StateBadge state={view.state} />
        <span className="spacer" />
        {active && (
          <span className="muted">
            Code <strong style={{ color: 'var(--primary)', letterSpacing: '0.08em' }}>{view.code}</strong>
          </span>
        )}
        <span className="badge">👥 {view.participantCount}</span>
        {active && <ConnectionIndicator status={status} />}
      </div>

      <div className="presenter-body">
        <ErrorAlert message={error} />

        {view.state === 'EN_ATTENTE' && (
          <div className="lobby">
            <div className="qr-box">
              <QRCodeSVG value={joinUrl} size={260} level="M" />
            </div>
            <div className="stack" style={{ gap: 18 }}>
              <p className="join-url">
                Scannez le QR code ou allez sur <strong>{displayHost}</strong> avec le code
              </p>
              <div className="big-code">{view.code}</div>
              <div className="counter">
                {view.participantCount} <small>participant(s) connecté(s)</small>
              </div>
              <div className="participants">
                {view.participants.map((p) => (
                  <span key={p} className="participant-chip">
                    {p}
                  </span>
                ))}
              </div>
              {publicUrl.includes('localhost') && (
                <p className="alert alert-warning small">
                  Le QR code pointe vers « localhost » : les téléphones ne pourront pas l’ouvrir. Ouvrez QuizFlow avec l’adresse IP de ce PC (ex. http://192.168.1.20:5173) ou définissez PUBLIC_URL.
                </p>
              )}
            </div>
          </div>
        )}

        {q && (view.state === 'QUESTION_OUVERTE' || view.state === 'QUESTION_FERMEE') && (
          <>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row">
                <span className="badge badge-primary">
                  Question {q.index + 1} / {q.total}
                </span>
                {q.choiceMode === 'MULTIPLE' && <span className="badge">Plusieurs réponses possibles</span>}
                <span className="spacer" />
                <div className="counter">
                  {answerCount} <small>/ {view.stats?.participantCount ?? view.participantCount} réponses</small>
                </div>
              </div>
              <div className="progress">
                <div style={{ width: `${(100 * answerCount) / Math.max(1, view.stats?.participantCount ?? view.participantCount)}%` }} />
              </div>
            </div>
            <div className="question-title">{q.text}</div>
            {showLive || closed ? (
              <ResultBars
                items={q.choices.map((c) => ({ id: c.id, label: c.label, count: distribution[c.id] ?? 0, correct: correctIds.includes(c.id) }))}
                total={answerCount}
                revealCorrect={closed && view.activityType === 'QUIZ'}
              />
            ) : (
              <ResultBars items={q.choices.map((c) => ({ id: c.id, label: c.label, count: 0 }))} total={0} />
            )}
          </>
        )}

        {view.state === 'TERMINEE' && (
          <div className="stack" style={{ gap: 20 }}>
            <h1>Session terminée 🎉</h1>
            {results ? (
              <>
                <div className="kpis">
                  <div className="kpi">
                    <div className="value">{results.session.participantCount}</div>
                    <div className="label">participants</div>
                  </div>
                  <div className="kpi">
                    <div className="value">{results.questions.length}</div>
                    <div className="label">questions</div>
                  </div>
                  {view.activityType === 'QUIZ' && (
                    <div className="kpi">
                      <div className="value">{averageSuccess(results)}%</div>
                      <div className="label">de bonnes réponses</div>
                    </div>
                  )}
                </div>
                {view.activityType === 'QUIZ' && results.leaderboard.length > 0 && (
                  <div className="podium">
                    <h2>Classement</h2>
                    {results.leaderboard.slice(0, 5).map((e) => (
                      <div key={e.pseudo} className={`podium-row r${e.rank}`}>
                        <span className="podium-rank">{e.rank}</span>
                        {e.pseudo}
                        <span className="spacer" />
                        <strong>{e.score} pt{e.score > 1 ? 's' : ''}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <PageLoader />
            )}
          </div>
        )}
      </div>

      <div className="presenter-footer">
        {view.state === 'EN_ATTENTE' && (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => window.confirm('Annuler cette session ?') && act(() => api.cancelSession(view.id))}>
              Annuler la session
            </button>
            <span className="spacer" />
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act(() => api.startSession(view.id))}>
              Démarrer la première question →
            </button>
          </>
        )}
        {view.state === 'QUESTION_OUVERTE' && (
          <>
            <label className="row small muted" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={showLive} onChange={(e) => setShowLive(e.target.checked)} /> Afficher les réponses en direct
            </label>
            <span className="spacer" />
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act(() => api.closeQuestion(view.id))}>
              Fermer la question et afficher la réponse
            </button>
          </>
        )}
        {view.state === 'QUESTION_FERMEE' && (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => window.confirm('Terminer la session maintenant ?') && act(() => api.endSession(view.id))}>
              Terminer maintenant
            </button>
            <span className="spacer" />
            {isLast ? (
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act(() => api.endSession(view.id))}>
                Terminer et voir les résultats
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act(() => api.nextQuestion(view.id))}>
                Question suivante →
              </button>
            )}
          </>
        )}
        {view.state === 'TERMINEE' && (
          <>
            <Link className="btn btn-outline" to="/dashboard">
              Retour aux activités
            </Link>
            <span className="spacer" />
            <Link className="btn btn-primary" to={`/sessions/${view.id}/results`}>
              Voir le détail des résultats
            </Link>
          </>
        )}
        {view.state === 'ANNULEE' && (
          <Link className="btn btn-outline" to="/dashboard">
            Retour aux activités
          </Link>
        )}
      </div>
    </div>
  )
}

function averageSuccess(r: ResultsView): number {
  const rates = r.questions.map((q) => q.successRate).filter((x): x is number => x !== undefined && x !== null)
  if (rates.length === 0) return 0
  return Math.round((100 * rates.reduce((a, b) => a + b, 0)) / rates.length)
}
