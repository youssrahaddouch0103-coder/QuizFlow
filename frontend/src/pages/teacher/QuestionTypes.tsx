import { useEffect, useRef } from 'react'
import type { TypeOption } from '../../lib/questionTypes'
import './QuestionTypes.css'

/** Petite icône du type (trait, couleur du texte). */
export function TypeIcon({ value }: { value: string }) {
  const paths: Record<string, string> = {
    'CHOIX:UNIQUE': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'CHOIX:MULTIPLE': 'M4 4h16v16H4zM8 12l3 3 5-6',
    NUAGE: 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z',
    TEXTE: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
    NOTE: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    CLASSEMENT: 'M4 6h10M4 12h7M4 18h4M17 5v14M14 16l3 3 3-3',
    QR: 'M5 5h14v10H10l-4 3v-3H5zM12 8.5a1.5 1.5 0 1 1 1.5 1.5c-.8.3-1.5.8-1.5 1.7M12 13.5v.01',
    IDEES: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  }
  return (
    <svg className="qt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[value]} />
    </svg>
  )
}

/** Aperçu dessiné de ce que voit la classe pour ce type. */
function TypePreview({ value }: { value: string }) {
  switch (value) {
    case 'CHOIX:UNIQUE':
    case 'CHOIX:MULTIPLE':
      return (
        <div className="qt-prev qt-prev--bars">
          {[70, 35, 50].map((w, i) => (
            <span key={i}>
              <i style={{ width: `${w}%`, background: `var(--c${i})` }} />
            </span>
          ))}
        </div>
      )
    case 'NUAGE':
      return (
        <div className="qt-prev qt-prev--cloud">
          <b style={{ color: 'var(--c0)', fontSize: '1.05rem' }}>idée</b>
          <b style={{ color: 'var(--c1)' }}>clair</b>
          <b style={{ color: 'var(--c2)', fontSize: '.7rem' }}>utile</b>
          <b style={{ color: 'var(--c3)', fontSize: '.85rem' }}>rapide</b>
        </div>
      )
    case 'TEXTE':
      return (
        <div className="qt-prev qt-prev--text">
          <span />
          <span />
        </div>
      )
    case 'NOTE':
      return <div className="qt-prev qt-prev--stars">★★★★<i>★</i></div>
    case 'CLASSEMENT':
      return (
        <div className="qt-prev qt-prev--rank">
          {[1, 2, 3].map((n) => (
            <span key={n}>
              <em>{n}</em>
              <i style={{ width: `${80 - n * 18}%` }} />
            </span>
          ))}
        </div>
      )
    default:
      return (
        <div className="qt-prev qt-prev--posts">
          {[5, 2].map((v) => (
            <span key={v}>
              <em>▲{v}</em>
              <i />
            </span>
          ))}
        </div>
      )
  }
}

/** Barre latérale qui glisse depuis la droite : choisir le type d'une nouvelle question (ou changer de type). */
export function QuestionTypeDrawer({ options, open, title, current, onPick, onClose }: {
  options: TypeOption[]
  open: boolean
  title: string
  current?: string
  onPick: (option: TypeOption) => void
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLButtonElement>('.qt-card')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div className={`qt-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <div ref={panel} className={`qt-drawer ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open}>
        <div className="qt-drawer__head">
          <strong>{title}</strong>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer" tabIndex={open ? 0 : -1}>
            ✕
          </button>
        </div>
        <div className="qt-drawer__list">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`qt-card ${current === o.value ? 'is-current' : ''}`}
              tabIndex={open ? 0 : -1}
              onClick={() => onPick(o)}
            >
              <TypePreview value={o.value} />
              <span className="qt-card__label">
                <TypeIcon value={o.value} />
                {o.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
