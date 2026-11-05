import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { ApiError, errorMessage } from '../../api/client'
import type { LiveEvent, PlayerState, QuestionLive } from '../../api/types'
import { ChoiceLetter, ConnectionIndicator, ErrorAlert, Spinner } from '../../components/ui'
import { percent } from '../../lib/format'
import { playerStore } from '../../lib/playerStore'
import { useSessionChannel } from '../../realtime/useSessionChannel'

/** Écran de l'étudiant pendant la session (mobile d'abord). */
export default function PlayPage() {
  const { code: rawCode } = useParams()
  const code = rawCode?.toUpperCase() ?? ''
  const navigate = useNavigate()
  const identity = playerStore.get(code)
  const [state, setState] = useState<PlayerState | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const reload = useCallback(async () => {
    if (!identity) return
    try {
      const s = await api.playerState(code, identity.token)
      setState(s)
      setSelected(s.myChoiceIds ?? [])
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        playerStore.clear(code)
        navigate(`/join/${code}`, { replace: true })
      } else {
        setError(errorMessage(e))
      }
    }
    // identity.token suffit : l'objet identity change à chaque rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, identity?.token, navigate])

  useEffect(() => {
    void reload()
  }, [reload])

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === 'QUESTION_OPENED') {
        const question = event.payload as QuestionLive
        setSelected([])
        setError(null)
        setState((s) => (s ? { ...s, state: 'QUESTION_OUVERTE', question, answered: false, myChoiceIds: [], closed: undefined, myAnswerCorrect: undefined } : s))
      } else if (event.type === 'QUESTION_CLOSED' || event.type === 'SESSION_ENDED') {
        void reload()
      } else if (event.type === 'SESSION_CANCELLED') {
        setState((s) => (s ? { ...s, state: 'ANNULEE' } : s))
      }
    },
    [reload],
  )

  const finished = state?.state === 'TERMINEE' || state?.state === 'ANNULEE'
  const status = useSessionChannel({ code: finished ? undefined : code, onEvent, onConnected: reload })

  if (!identity) return <Navigate to={`/join/${code}`} replace />

  const toggle = (choiceId: string) => {
    if (!state?.question) return
    if (state.question.choiceMode === 'UNIQUE') setSelected([choiceId])
    else setSelected((sel) => (sel.includes(choiceId) ? sel.filter((x) => x !== choiceId) : [...sel, choiceId]))
  }

  const submit = async () => {
    if (!state?.question || selected.length === 0) return
    setSending(true)
    setError(null)
    try {
      await api.answer(code, identity.token, state.question.id, selected)
      setState((s) => (s ? { ...s, answered: true, myChoiceIds: selected } : s))
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'ALREADY_ANSWERED' || e.code === 'QUESTION_CLOSED')) void reload()
      setError(errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="player">
      <div className="player-top">
        <span>👤 {identity.pseudo}</span>
        <span className="muted small">{state?.title}</span>
        {!finished && <ConnectionIndicator status={status} />}
      </div>
      <div className="player-body">
        <ErrorAlert message={error} />
        {!state && (
          <div className="player-center">
            <Spinner />
          </div>
        )}
        {state && <PlayerContent state={state} selected={selected} sending={sending} onToggle={toggle} onSubmit={submit} />}
      </div>
    </div>
  )
}

interface ContentProps {
  state: PlayerState
  selected: string[]
  sending: boolean
  onToggle: (id: string) => void
  onSubmit: () => void
}

function PlayerContent({ state, selected, sending, onToggle, onSubmit }: ContentProps) {
  const q = state.question

  if (state.state === 'EN_ATTENTE') {
    return (
      <div className="player-center">
        <div className="big-emoji">🙌</div>
        <h2>Vous êtes dans la session !</h2>
        <p className="muted">La première question va bientôt s’afficher ici.</p>
        <Spinner />
      </div>
    )
  }

  if (state.state === 'QUESTION_OUVERTE' && q && !state.answered) {
    return (
      <>
        <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>
          Question {q.index + 1} / {q.total}
          {q.choiceMode === 'MULTIPLE' ? ' · plusieurs réponses' : ''}
        </span>
        <div className="player-question">{q.text}</div>
        <div className="stack" style={{ gap: 10 }}>
          {q.choices.map((c, i) => (
            <button key={c.id} className={`answer-btn ${selected.includes(c.id) ? 'selected' : ''}`} onClick={() => onToggle(c.id)}>
              <ChoiceLetter index={i} />
              {c.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={sending || selected.length === 0} onClick={onSubmit}>
          {sending ? 'Envoi…' : 'Valider ma réponse'}
        </button>
      </>
    )
  }

  if (state.state === 'QUESTION_OUVERTE' && state.answered) {
    return (
      <div className="player-center">
        <div className="big-emoji">✅</div>
        <h2>Réponse envoyée</h2>
        <p className="muted">Attendez que l’enseignant ferme la question.</p>
      </div>
    )
  }

  if (state.state === 'QUESTION_FERMEE' && q) {
    const closed = state.closed
    const quiz = state.type === 'QUIZ'
    const total = closed?.answerCount ?? 0
    let headline = 'Merci pour votre réponse !'
    let emoji = '📊'
    if (quiz) {
      if (!state.answered) {
        headline = 'Pas de réponse'
        emoji = '⏱️'
      } else if (state.myAnswerCorrect) {
        headline = 'Bonne réponse !'
        emoji = '🎉'
      } else {
        headline = 'Ce n’est pas ça…'
        emoji = '😕'
      }
    }
    return (
      <>
        <div className="player-center" style={{ flex: 'none' }}>
          <div className="big-emoji">{emoji}</div>
          <h2>{headline}</h2>
        </div>
        <div className="player-question" style={{ fontSize: '1.1rem' }}>
          {q.text}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {q.choices.map((c, i) => {
            const isCorrect = closed?.correctChoiceIds.includes(c.id)
            const mine = state.myChoiceIds.includes(c.id)
            const cls = quiz ? (isCorrect ? 'correct' : mine ? 'wrong' : '') : mine ? 'selected' : ''
            return (
              <button key={c.id} className={`answer-btn ${cls}`} disabled>
                <ChoiceLetter index={i} />
                {c.label}
                <span className="pct">{percent(closed?.distribution[c.id] ?? 0, total)}%</span>
              </button>
            )
          })}
        </div>
        <p className="muted small" style={{ textAlign: 'center' }}>
          Prochaine question dans un instant…
        </p>
      </>
    )
  }

  if (state.state === 'TERMINEE') {
    const r = state.result
    return (
      <div className="player-center">
        <div className="big-emoji">🏁</div>
        <h2>Session terminée</h2>
        {r ? (
          <>
            <p style={{ fontSize: '2.4rem', fontWeight: 800 }}>
              {r.score} / {r.questionCount}
            </p>
            <p className="muted">
              Vous êtes {r.rank === 1 ? '1er 🥇' : `${r.rank}e`} sur {r.participantCount} participant(s).
            </p>
          </>
        ) : (
          <p className="muted">Merci pour votre participation !</p>
        )}
        <Link to="/join" className="btn btn-outline">
          Rejoindre une autre session
        </Link>
      </div>
    )
  }

  if (state.state === 'ANNULEE') {
    return (
      <div className="player-center">
        <div className="big-emoji">🚫</div>
        <h2>Session annulée</h2>
        <Link to="/join" className="btn btn-outline">
          Rejoindre une autre session
        </Link>
      </div>
    )
  }

  return (
    <div className="player-center">
      <Spinner />
    </div>
  )
}
