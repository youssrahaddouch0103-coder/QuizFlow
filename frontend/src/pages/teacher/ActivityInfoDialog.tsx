import { useEffect, useRef, useState, type FormEvent } from 'react'

/** Petite fenêtre : titre et description de l'activité (à la création, puis via « Modifier »). */
export default function ActivityInfoDialog({ open, isNew, heading, title, description, onSave, onCancel }: {
  open: boolean
  isNew: boolean
  heading: string
  title: string
  description: string
  onSave: (title: string, description: string) => void
  onCancel: () => void
}) {
  const [t, setT] = useState(title)
  const [d, setD] = useState(description)
  const titleRef = useRef<HTMLInputElement>(null)

  // À chaque ouverture, on repart des valeurs actuelles de l'activité.
  useEffect(() => {
    if (!open) return
    setT(title)
    setD(description)
    window.setTimeout(() => titleRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (t.trim()) onSave(t.trim(), d.trim())
  }

  return (
    <div className="info-dialog__backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-dialog-title" onSubmit={submit}>
        <h2 id="info-dialog-title">{isNew ? heading : 'Informations de l’activité'}</h2>
        <div className="field">
          <label htmlFor="info-title">Titre</label>
          <input id="info-title" ref={titleRef} className="input" maxLength={200} required value={t} placeholder="Ex. Chapitre 3 : les piles et les files" onChange={(e) => setT(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="info-desc">Description (facultatif)</label>
          <textarea id="info-desc" className="textarea" rows={3} maxLength={1000} value={d} onChange={(e) => setD(e.target.value)} />
        </div>
        <div className="info-dialog__actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={!t.trim()}>
            {isNew ? 'Créer' : 'Valider'}
          </button>
        </div>
      </form>
    </div>
  )
}
