import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { Activity, ActivityType, AiGeneratedQuestion, ChoiceMode, Question, QuestionKind } from '../../api/types'
import { ChoiceLetter, ErrorAlert, PageLoader, StatusBadge } from '../../components/ui'
import { usesChoices } from '../../lib/format'
import AiPanel from './AiPanel'
import ActivitySymbol from '../../components/ActivitySymbol'
import './ActivityEditorPage.css'
import './ActivityEditorPolish.css'
import QuestionNavigator from './QuestionNavigator'
import ActivityInfoDialog from './ActivityInfoDialog'
import { QuestionTypeDrawer, TypeIcon } from './QuestionTypes'
import { QUIZ_TYPES, TYPE_OPTIONS, typeOption, typeValue, type TypeOption } from '../../lib/questionTypes'
import './ActivityEditorStudio.css'

const MAX_CHOICES = 6
const MIN_CHOICES = 2

/** Question en cours d'édition : "uid" sert seulement de clé React. */
type DraftChoice = { uid: string; id?: string; label: string; correct: boolean }
type DraftQuestion = { uid: string; id?: string; text: string; kind: QuestionKind; choiceMode: ChoiceMode; choices: DraftChoice[] }


let counter = 0
const uid = () => `tmp-${++counter}`

const emptyQuestion = (kind: QuestionKind = 'CHOIX', choiceMode: ChoiceMode = 'UNIQUE'): DraftQuestion => ({
  uid: uid(),
  text: '',
  kind,
  choiceMode,
  // Choix et classement commencent avec deux lignes ; les autres types n'en ont pas besoin.
  choices: usesChoices(kind)
    ? [
        { uid: uid(), label: '', correct: false },
        { uid: uid(), label: '', correct: false },
      ]
    : [],
})

const toDraft = (q: Question): DraftQuestion => ({
  uid: uid(),
  id: q.id,
  text: q.text ?? '',
  kind: q.kind ?? 'CHOIX',
  choiceMode: q.choiceMode,
  choices: q.choices.map((c) => ({ uid: uid(), id: c.id, label: c.label ?? '', correct: c.correct })),
})

export default function ActivityEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [params] = useSearchParams()
  // Quiz : questions à choix avec bonnes réponses. Sondage : tous les types de questions.
  const [type, setType] = useState<ActivityType>(params.get('type') === 'SONDAGE' ? 'SONDAGE' : 'QUIZ')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => (isNew ? [emptyQuestion()] : []))
  const [saved, setSaved] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  // Les boutons Retour, Enregistrer et Lancer sont affichés dans la barre du haut (voir TeacherLayout).
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setHeaderSlot(document.getElementById('header-actions')), [])
  const activeQuestion = questions.find(q => q.uid === selectedQuestion)?.uid ?? questions[0]?.uid
  // Barre des types : null = fermée ; 'add' = nouvelle question ; sinon uid de la question dont on change le type.
  const [typeDrawer, setTypeDrawer] = useState<'add' | string | null>(null)
  const closeDrawer = useCallback(() => setTypeDrawer(null), [])
  const addQuestion = (option: TypeOption) => {
    const question = emptyQuestion(option.kind, option.mode)
    setQuestions(qs => [...qs, question])
    setSelectedQuestion(question.uid)
    setDirty(true)
    window.setTimeout(() => document.getElementById(`question-${question.uid}`)?.focus(), 300)
  }

  useEffect(() => {
    if (!id) return
    api
      .getActivity(id)
      .then((a) => {
        setSaved(a)
        setTitle(a.title ?? '')
        setDescription(a.description ?? '')
        setType(a.type)
        setQuestions(a.questions.map(toDraft))
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const quiz = type === 'QUIZ'
  // Petite fenêtre « titre et description » : ouverte d'office pour une nouvelle activité.
  const [infoOpen, setInfoOpen] = useState(isNew)
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

  /** Changement de type depuis la liste : le choix unique et le choix multiple restent deux modes de CHOIX. */
  const setKind = (q: DraftQuestion, value: string) => {
    if (value.startsWith('CHOIX:')) {
      const mode = value.slice(6) as ChoiceMode
      if (q.kind === 'CHOIX') return setMode(q, mode)
      return patchQuestion(q.uid, { kind: 'CHOIX', choiceMode: mode })
    }
    const kind = value as QuestionKind
    // Un classement a besoin d'au moins deux éléments.
    const choices = kind === 'CLASSEMENT' && q.choices.length < MIN_CHOICES
      ? [...q.choices, ...Array.from({ length: MIN_CHOICES - q.choices.length }, () => ({ uid: uid(), label: '', correct: false }))]
      : q.choices
    patchQuestion(q.uid, { kind, choices })
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

  const pickType = (option: TypeOption) => {
    if (typeDrawer === 'add') addQuestion(option)
    else {
      const q = questions.find((x) => x.uid === typeDrawer)
      if (q) setKind(q, option.value)
    }
    setTypeDrawer(null)
  }
  const drawerQuestion = typeDrawer && typeDrawer !== 'add' ? questions.find((x) => x.uid === typeDrawer) : undefined

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
      kind: 'CHOIX' as QuestionKind,
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
        kind: q.kind,
        choiceMode: q.choiceMode,
        choices: usesChoices(q.kind) ? q.choices.map((c) => ({ id: c.id, label: c.label, correct: quiz && q.kind === 'CHOIX' && c.correct })) : [],
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
        setInfoOpen(true)
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
    if (/titre/i.test(message)) setInfoOpen(true)
  }

  if (loading) return <PageLoader />

  return (
    <div className="stack activity-editor" style={{ gap: 20 }}>
      <h1 className="sr-only">{isNew ? (quiz ? 'Nouveau quiz' : 'Nouveau sondage') : 'Modifier l’activité'}</h1>
      {headerSlot &&
        createPortal(
          <div className="editor-topbar">
            <Link to="/dashboard" className="editor-topbar__back">
              ← Mes activités
            </Link>
            <span className="spacer" />
            {saved && <StatusBadge status={saved.status} />}
            {dirty && <span className="badge badge-warning">Non enregistré</span>}
            {!readOnly && (
              <button className="btn btn-outline btn-sm" onClick={save} disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
            {saved && saved.status !== 'ARCHIVEE' && (
              <button className="btn btn-primary btn-sm" onClick={launch} disabled={busy || !canLaunch} title={launchHint ?? undefined}>
                Lancer une session →
              </button>
            )}
          </div>,
          headerSlot,
        )}
      {saved && saved.status !== 'ARCHIVEE' && launchHint && <p className="editor-launch-hint">{launchHint}</p>}

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

      <div className={`editor-layout ${readOnly ? '' : 'has-side'}`}>
        <QuestionNavigator questions={questions} selected={activeQuestion} onSelect={setSelectedQuestion} onAdd={() => setTypeDrawer('add')} readOnly={readOnly} />
        <fieldset disabled={readOnly} className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="card editor-title-bar">
            <ActivitySymbol kind={quiz ? 'quiz' : 'poll'} />
            <div className="editor-title-bar__text">
              <strong className={title.trim() ? '' : 'is-missing'}>{title.trim() || 'Sans titre'}</strong>
              {description.trim() && <span>{description}</span>}
            </div>
            {!readOnly && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setInfoOpen(true)}>
                Modifier
              </button>
            )}
          </section>

          <div className="editor-questions-heading"><h2>Vos questions <span>{questions.length}</span></h2></div>
          {questions.map((q, qi) => (
            <div key={q.uid} className="card question-card" hidden={q.uid !== activeQuestion}>
              <div className="question-head">
                <span className="question-number">Question {qi + 1}</span>
                <span className="spacer" />
                <button type="button" className="qt-chip" onClick={() => setTypeDrawer(q.uid)} aria-label={`Type de la question ${qi + 1} : ${typeOption(typeValue(q.kind, q.choiceMode)).label}. Changer de type`}>
                  <TypeIcon value={typeValue(q.kind, q.choiceMode)} />
                  {typeOption(typeValue(q.kind, q.choiceMode)).label}
                  <small>Changer</small>
                </button>
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
                {usesChoices(q.kind) && q.choices.map((c, ci) => (
                  <div key={c.uid} className={`choice-row ${quiz && q.kind === 'CHOIX' && c.correct ? 'editor-choice-correct' : ''}`}>
                    <ChoiceLetter index={ci} />
                    <input
                      aria-label={`${q.kind === 'CLASSEMENT' ? 'Élément' : 'Choix'} ${ci + 1} de la question ${qi + 1}`}
                      className="input"
                      maxLength={200}
                      placeholder={`${q.kind === 'CLASSEMENT' ? 'Élément' : 'Choix'} ${ci + 1}`}
                      value={c.label}
                      onChange={(e) => setChoice(q, c.uid, { label: e.target.value })}
                    />
                    {quiz && q.kind === 'CHOIX' && (
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
                {usesChoices(q.kind) && (
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={q.choices.length >= MAX_CHOICES}
                      onClick={() => patchQuestion(q.uid, { choices: [...q.choices, { uid: uid(), label: '', correct: false }] })}
                    >
                      {q.kind === 'CLASSEMENT' ? '+ Ajouter un élément' : '+ Ajouter un choix'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-lg editor-add-question" onClick={() => setTypeDrawer('add')}>
            + Ajouter une question
          </button>
          {!readOnly && (
            <button type="button" className="btn btn-primary btn-lg editor-save-bottom" onClick={save} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
        </fieldset>

        {!readOnly && (
          <aside className="editor-side" aria-label="Assistant IA">
            <AiPanel type={type} onAdd={addGenerated} />
          </aside>
        )}
      </div>

      <ActivityInfoDialog
        open={infoOpen}
        isNew={isNew && !saved}
        heading={quiz ? 'Nouveau quiz' : 'Nouveau sondage'}
        title={title}
        description={description}
        onSave={(t, d) => {
          setTitle(t)
          setDescription(d)
          setDirty(true)
          setInfoOpen(false)
        }}
        onCancel={() => (isNew && !saved && !title.trim() ? navigate('/dashboard') : setInfoOpen(false))}
      />
      <QuestionTypeDrawer
        options={quiz ? QUIZ_TYPES : TYPE_OPTIONS}
        open={typeDrawer !== null}
        title={typeDrawer === 'add' ? 'Ajouter une question' : 'Changer le type'}
        current={drawerQuestion ? typeValue(drawerQuestion.kind, drawerQuestion.choiceMode) : undefined}
        onPick={pickType}
        onClose={closeDrawer}
      />
    </div>
  )
}
