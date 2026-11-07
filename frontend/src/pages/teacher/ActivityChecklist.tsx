type ChecklistQuestion = {
  text: string
  choiceMode: string
  choices: { label: string; correct: boolean }[]
}

export default function ActivityChecklist({ title, questions, quiz }: {
  title: string
  questions: ChecklistQuestion[]
  quiz: boolean
}) {
  const hasQuestions = questions.length > 0
  const items = [
    { label: 'Un titre pour votre activité', done: !!title.trim() },
    { label: 'Des questions rédigées', done: hasQuestions && questions.every(q => q.text.trim()) },
    { label: '2 à 6 choix remplis par question', done: hasQuestions && questions.every(q => q.choices.length >= 2 && q.choices.length <= 6 && q.choices.every(c => c.label.trim())) },
    ...(quiz ? [{ label: 'Les bonnes réponses indiquées', done: hasQuestions && questions.every(q => q.choiceMode === 'UNIQUE' ? q.choices.filter(c => c.correct).length === 1 : q.choices.some(c => c.correct)) }] : []),
  ]
  return (
    <section className="card editor-checklist" aria-label="Préparation de l’activité">
      <span className="editor-eyebrow">Votre progression</span>
      <h3>Avant de lancer</h3>
      <ul>
        {items.map(item => <li key={item.label} className={item.done ? 'is-complete' : ''}>
          <span className="editor-check-mark" aria-hidden="true">{item.done ? '✓' : '·'}</span>
          <span>{item.label}<span className="editor-check-status">{item.done ? 'Complété' : 'À compléter'}</span></span>
        </li>)}
      </ul>
      <p>Vous pouvez enregistrer un brouillon à tout moment. La validation finale a lieu à l’enregistrement.</p>
    </section>
  )
}
