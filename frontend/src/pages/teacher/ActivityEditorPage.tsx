import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { Activity, ActivityType, AiGeneratedQuestion, ChoiceMode, Question } from '../../api/types'
import { ChoiceLetter, ErrorAlert, PageLoader, StatusBadge } from '../../components/ui'
import { typeLabel } from '../../lib/format'
import AiPanel from './AiPanel'
import ActivitySymbol from '../../components/ActivitySymbol'
import './ActivityEditorPage.css'
import './ActivityEditorPolish.css'
import QuestionNavigator from './QuestionNavigator'
import './ActivityEditorStudio.css'

const MAX_CHOICES = 6
const MIN_CHOICES = 2

/** Question en cours d'édition : "uid" sert seulement de clé React. */
type DraftChoice = { uid: string; id?: string; label: string; correct: boolean }
type DraftQuestion = { uid: string; id?: string; text: string; choiceMode: ChoiceMode; choices: DraftChoice[] }

let counter = 0
const uid = () => `tmp-${++counter}`

const emptyQuestion = (): DraftQuestion => ({
  uid: uid(),
  text: '',
  choiceMode: 'UNIQUE',
  choices: [
    { uid: uid(), label: '', correct: false },
    { uid: uid(), label: '', correct: false },
  ],
})

const toDraft = (q: Question): DraftQuestion => ({
  uid: uid(),
  id: q.id,
  text: q.text ?? '',
  choiceMode: q.choiceMode,
  choices: q.choices.map((c) => ({ uid: uid(), id: c.id, label: c.label ?? '', correct: c.correct })),
})

export default function ActivityEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !id

  const [type, setType] = useState<ActivityType>((params.get('type') as ActivityType) || 'QUIZ')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => (isNew ? [emptyQuestion()] : []))
  const [saved, setSaved] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  // Passe à true après un enregistrement sans titre : le champ est alors signalé en rouge.
  const [titleWarning, setTitleWarning] = useState(false)
  const activeQuestion = questions.find(q => q.uid === selectedQuestion)?.uid ?? questions[0]?.uid
  const addQuestion = () => {
    const question = emptyQuestion()
    setQuestions(qs => [...qs, question])
    setSelectedQuestion(question.uid)
    setDirty(true)
  }

  useEffect(() => {
    if (!id) return
    api
      .getActivity(id)
      .then((a) => {
        setSaved(a)
        setType(a.type)
        setTitle(a.title ?? '')
        setTitleWarning(!(a.title ?? '').trim())
        setDescription(a.description ?? '')
        setQuestions(a.questions.map(toDraft))
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const quiz = type === 'QUIZ'
  const readOnly = !!saved && (saved.locked || saved.status === 'ARCHIVEE')

  const update = (fn: (qs: DraftQuestion[]) => DraftQuestion[]) => {
    setQuestions(fn)
    setDirty(true)
  }
  const patchQuestion = (quid: string, patch: Partial<DraftQuestion>) =>
    update((qs) => qs.map((q) => (q.uid === quid ? { ...q, ...patch } : q)))

  const setChoice = (q: DraftQuestion, cuid: string, patch: Partial<DraftChoice>) =>
    patchQuestion(q.uid, { choices: q.choices.map((c) => (c.uid === cuid ? { ...c, ...patch } : c)) })

  const toggleCorrect = (q: DraftQuestion, cuid: string) => {
    const choices =
      q.choiceMode === 'UNIQUE'
        ? q.choices.map((c) => ({ ...c, correct: c.uid === cuid ? !c.correct : false }))
        : q.choices.map((c) => (c.uid === cuid ? { ...c, correct: !c.correct } : c))
    patchQuestion(q.uid, { choices })
  }

  const setMode = (q: DraftQuestion, mode: ChoiceMode) => {
    let choices = q.choices
    // En passant en choix unique, on ne garde que la première bonne réponse.
    if (mode === 'UNIQUE') {
      let seen = false
      choices = choices.map((c) => {
        if (c.correct && !seen) {
          seen = true
          return c
        }
        return { ...c, correct: false }
      })
    }
    patchQuestion(q.uid, { choiceMode: mode, choices })
  }

  const move = (index: number, delta: number) =>
    update((qs) => {
      const next = [...qs]
      const target = index + delta
      if (target < 0 || target >= next.length) return qs
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const addGenerated = (generated: AiGeneratedQuestion[]) => {
    const drafts: DraftQuestion[] = generated.map((g) => ({
      uid: uid(),
      text: g.text,
      choiceMode: g.choiceMode,
      choices: g.choices.map((c) => ({ uid: uid(), label: c.label, correct: quiz && c.correct })),
    }))
    // Si la seule question existante est vide, on la remplace.
    update((qs) => {
      const onlyEmpty = qs.length === 1 && !qs[0].text.trim() && qs[0].choices.every((c) => !c.label.trim())
      return onlyEmpty ? drafts : [...qs, ...drafts]
    })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const body = {
      type,
      title,
      description,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        choiceMode: q.choiceMode,
        choices: q.choices.map((c) => ({ id: c.id, label: c.label, correct: quiz && c.correct })),
      })),
    }
    try {
      const result = isNew ? await api.createActivity(body) : await api.updateActivity(id!, body)
      setSaved(result)
      setQuestions(result.questions.map(toDraft))
      setDirty(false)
      if (isNew) navigate(`/activities/${result.id}/edit`, { replace: true })
      if (!title.trim()) {
        // Enregistré en brouillon, mais on montre tout de suite ce qui manque.
        setTitleWarning(true)
        window.setTimeout(() => {
          const field = document.getElementById('title')
          field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          field?.focus()
        }, 100)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const launch = async () => {
    if (!saved) return
    setBusy(true)
    try {
      const session = await api.launchSession(saved.id)
      navigate(`/sessions/${session.id}/live`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const canLaunch = saved?.status === 'PRETE' && !dirty
  const launchHint = !saved
    ? null
    : dirty
      ? 'Enregistrez vos modifications pour pouvoir lancer la session.'
      : saved.status === 'BROUILLON'
        ? 'Complétez l’activité (voir ci-dessous) puis enregistrez pour pouvoir la lancer.'
        : null

  /** Amène l'enseignant au champ concerné par une erreur de validation. */
  const goToError = (message: string) => {
    const match = message.match(/^Question (\d+)/)
    if (match) {
      const q = questions[Number(match[1]) - 1]
      if (q) {
        setSelectedQuestion(q.uid)
        window.setTimeout(() => {
          const el = document.getElementById(`question-${q.uid}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el?.focus()
        }, 50)
      }
      return
    }
    const field = /titre/i.test(message) ? document.getElementById('title') : null
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field?.focus()
  }

  if (loading) return <PageLoader />

  return (
    <div className="stack activity-editor" style={{ gap: 20 }}>
      <div className="page-head editor-heading">
        <div className="stack" style={{ gap: 6 }}>
          <Link to="/dashboard" className="small">
            ← Mes activités
          </Link>
          <div className="row">
            <h1>{isNew ? `Créer un ${typeLabel[type].toLowerCase()}` : 'Modifier l’activité'}</h1>
            {saved && <StatusBadge status={saved.status} />}
            {dirty && <span className="badge badge-warning">Modifications non enregistrées</span>}
          </div>
          <p className="muted small">Préparez vos questions à votre rythme, puis partagez votre activité.</p>
        </div>
        <div className="editor-save-actions">
          <div className="row">
            {!readOnly && (
              <button className="btn btn-outline" onClick={save} disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
            {saved && saved.status !== 'ARCHIVEE' && (
              <button className="btn btn-primary" onClick={launch} disabled={busy || !canLaunch}>
                Lancer une session →
              </button>
            )}
          </div>
          {saved && saved.status !== 'ARCHIVEE' && launchHint && <p className="editor-launch-hint">{launchHint}</p>}
        </div>
      </div>

      <ErrorAlert message={error} />
      {readOnly && (
        <div className="alert alert-warning">
          {saved?.status === 'ARCHIVEE'
            ? 'Cette activité est archivée : restaurez-la depuis le tableau de bord pour la modifier.'
            : 'Cette activité a déjà été jouée en classe : elle est verrouillée pour garder un historique fiable. Dupliquez-la pour la modifier.'}
        </div>
      )}
      {saved && saved.errors.length > 0 && !readOnly && (
        <div className="alert alert-warning">
          Enregistrée en brouillon. Pour pouvoir la lancer, il reste à compléter (cliquez pour y aller) :
          <ul>
            {saved.errors.map((e) => (
              <li key={e}>
                <button type="button" className="editor-error-link" onClick={() => goToError(e)}>
                  {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readOnly && (
        <AiPanel type={type} onAdd={addGenerated} />
      )}

      <div className="editor-layout">
        <QuestionNavigator questions={questions} selected={activeQuestion} onSelect={setSelectedQuestion} onAdd={addQuestion} readOnly={readOnly} />
        <fieldset disabled={readOnly} className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="card editor-activity-settings">
          <div className="stack editor-intro">
            <div className="editor-section-heading">
              <ActivitySymbol kind={quiz ? 'quiz' : 'poll'} />
              <div><h2>Informations de l’activité</h2><p className="muted small">Titre et description présentés aux participants.</p></div>
            </div>
            {isNew && (
              <div className="tabs" style={{ alignSelf: 'flex-start' }}>
                {(['QUIZ', 'SONDAGE'] as ActivityType[]).map((t) => (
                  <button key={t} type="button" aria-pressed={type === t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            )}
            <div className="field">
              <label htmlFor="title">Titre de l’activité</label>
              <input
                id="title"
                className={`input ${titleWarning && !title.trim() ? 'is-invalid' : ''}`}
                maxLength={200}
                value={title}
                aria-invalid={titleWarning && !title.trim()}
                aria-describedby={titleWarning && !title.trim() ? 'title-error' : undefined}
                placeholder={quiz ? 'Ex. Testez vos connaissances sur le climat' : 'Ex. Votre avis sur notre atelier'}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
              />
              {titleWarning && !title.trim() && (
                <p id="title-error" className="editor-field-error">
                  Donnez un titre à votre activité : sans titre, elle reste en brouillon et ne peut pas être lancée.
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="desc">Description (facultatif)</label>
              <input
                id="desc"
                className="input"
                maxLength={1000}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setDirty(true)
                }}
              />
            </div>
          </div>
          </section>

          <div className="editor-questions-heading"><h2>Vos questions <span>{questions.length}</span></h2><p className="muted small">{quiz ? 'Ajoutez les choix et indiquez les bonnes réponses.' : 'Ajoutez les choix proposés aux participants.'}</p></div>
          {questions.map((q, qi) => (
            <div key={q.uid} className="card question-card" hidden={q.uid !== activeQuestion}>
              <div className="question-head">
                <span className="question-number">Question {qi + 1}</span>
                <span className="spacer" />
                <select aria-label={`Type de réponse pour la question ${qi + 1}`} className="select" style={{ width: 'auto' }} value={q.choiceMode} onChange={(e) => setMode(q, e.target.value as ChoiceMode)}>
                  <option value="UNIQUE">Choix unique</option>
                  <option value="MULTIPLE">Choix multiple</option>
                </select>
                <button type="button" className="btn btn-ghost btn-sm" title="Monter" onClick={() => move(qi, -1)} disabled={qi === 0}>
                  ↑
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title="Descendre" onClick={() => move(qi, 1)} disabled={qi === questions.length - 1}>
                  ↓
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => update((qs) => qs.filter((x) => x.uid !== q.uid))}>
                  Supprimer
                </button>
              </div>
              <div className="stack">
                <label className="editor-field-label" htmlFor={`question-${q.uid}`}>Votre question</label>
                <textarea
                  id={`question-${q.uid}`}
                  className="textarea"
                  style={{ minHeight: 60 }}
                  maxLength={500}
                  placeholder="Énoncé de la question"
                  value={q.text}
                  onChange={(e) => patchQuestion(q.uid, { text: e.target.value })}
                />
                {q.choices.map((c, ci) => (
                  <div key={c.uid} className={`choice-row ${quiz && c.correct ? 'editor-choice-correct' : ''}`}>
                    <ChoiceLetter index={ci} />
                    <input
                      aria-label={`Choix ${ci + 1} de la question ${qi + 1}`}
                      className="input"
                      maxLength={200}
                      placeholder={`Choix ${ci + 1}`}
                      value={c.label}
                      onChange={(e) => setChoice(q, c.uid, { label: e.target.value })}
                    />
                    {quiz && (
                      <label className={`correct-toggle ${c.correct ? 'on' : ''}`}>
                        <input type={q.choiceMode === 'UNIQUE' ? 'radio' : 'checkbox'} name={`correct-${q.uid}`} checked={c.correct} onChange={() => toggleCorrect(q, c.uid)} />
                        Bonne réponse
                      </label>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Retirer ce choix"
                      disabled={q.choices.length <= MIN_CHOICES}
                      onClick={() => patchQuestion(q.uid, { choices: q.choices.filter((x) => x.uid !== c.uid) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={q.choices.length >= MAX_CHOICES}
                    onClick={() => patchQuestion(q.uid, { choices: [...q.choices, { uid: uid(), label: '', correct: false }] })}
                  >
                    + Ajouter un choix
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-lg editor-add-question" onClick={addQuestion}>
            + Ajouter une question
          </button>
        </fieldset>

      </div>
    </div>
  )
}
