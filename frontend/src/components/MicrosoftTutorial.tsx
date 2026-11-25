import { useEffect, useRef, useState } from 'react'
import { Logo } from './ui'
import './MicrosoftTutorial.css'

type App = 'ppt' | 'teams'

const STEPS: Record<App, string[]> = {
  ppt: ['Insérez QuizFlow dans une diapositive', 'Choisissez l’activité', 'Lancez-la pendant le diaporama'],
  teams: ['Ajoutez QuizFlow à la réunion', 'Lancez l’activité', 'Affichez-la pour tous'],
}
const DURATION = 4800

/** Fenêtre « tutoriel » animée : relier QuizFlow à PowerPoint ou à Teams, en 3 étapes. */
export default function MicrosoftTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [app, setApp] = useState<App>('ppt')
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)

  // Fermer avec Échap, et placer le focus dans la fenêtre.
  useEffect(() => {
    if (!open) return
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lecture automatique des étapes (sauf si l'utilisateur a réduit les animations).
  useEffect(() => {
    if (!open || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => setStep((s) => (s + 1) % 3), DURATION)
    return () => window.clearTimeout(t)
  }, [open, paused, step, app])

  if (!open) return null

  const pick = (a: App) => {
    setApp(a)
    setStep(0)
  }
  const go = (s: number) => setStep((s + 3) % 3)

  return (
    <div className="mt-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className="mt-dialog" role="dialog" aria-modal="true" aria-labelledby="mt-title" tabIndex={-1}>
        <div className="mt-head">
          <h2 id="mt-title">QuizFlow avec Microsoft</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="mt-tabs" role="tablist" aria-label="Application">
          <button type="button" role="tab" aria-selected={app === 'ppt'} className={app === 'ppt' ? 'is-on' : ''} onClick={() => pick('ppt')}>
            <span className="mt-app mt-app--ppt" aria-hidden="true">P</span> PowerPoint
          </button>
          <button type="button" role="tab" aria-selected={app === 'teams'} className={app === 'teams' ? 'is-on' : ''} onClick={() => pick('teams')}>
            <span className="mt-app mt-app--teams" aria-hidden="true">T</span> Teams
          </button>
        </div>

        <div className="mt-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {/* key : la scène est recréée à chaque étape, ce qui relance ses animations */}
          <div key={`${app}-${step}`} className={`mt-scene mt-scene--${app} mt-s${step + 1}`} aria-hidden="true">
            {app === 'ppt' ? <PptScene step={step} /> : <TeamsScene step={step} />}
          </div>
          {!paused && <div key={`bar-${app}-${step}`} className="mt-progress" style={{ animationDuration: `${DURATION}ms` }} />}
        </div>

        <p className="mt-caption" aria-live="polite">
          <b>{step + 1}</b> {STEPS[app][step]}
        </p>

        <div className="mt-nav">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => go(step - 1)} aria-label="Étape précédente">
            ←
          </button>
          <div className="mt-dots">
            {STEPS[app].map((label, i) => (
              <button key={label} type="button" className={i === step ? 'is-on' : ''} onClick={() => go(i)} aria-label={`Étape ${i + 1} : ${label}`} />
            ))}
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => go(step + 1)} aria-label="Étape suivante">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

/** Petit curseur de souris animé (sa trajectoire est définie en CSS pour chaque étape). */
function Cursor() {
  return (
    <svg className="mt-cursor" viewBox="0 0 24 24">
      <path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function Bars() {
  return (
    <div className="mt-bars">
      {[68, 22, 10].map((w, i) => (
        <span key={w}>
          <em style={{ background: `var(--c${i})` }}>{'ABC'[i]}</em>
          <i style={{ ['--w' as string]: `${w}%`, background: `var(--c${i})` }} />
        </span>
      ))}
    </div>
  )
}

function QfCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-qf">
      <div className="mt-qf__brand">
        <Logo size={14} /> QuizFlow
      </div>
      {children}
    </div>
  )
}

function PptScene({ step }: { step: number }) {
  if (step === 2) {
    // Diaporama : le code, le QR code, puis les réponses qui arrivent
    return (
      <div className="mt-show">
        <div className="mt-show__slide">
          <div className="mt-show__lobby">
            <div className="mt-qr" />
            <div>
              <small>Code</small>
              <strong className="mt-code">K7P2QX</strong>
            </div>
          </div>
          <Bars />
        </div>
        <div className="mt-phones">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ animationDelay: `${1.6 + i * 0.25}s` }} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="mt-win mt-win--ppt">
      <div className="mt-win__bar">
        <span className="mt-app mt-app--ppt">P</span>
        <i>Accueil</i>
        <i>Insertion</i>
        <b className="mt-ribbon-btn">Compléments</b>
      </div>
      <div className="mt-ppt">
        <div className="mt-ppt__thumbs">
          <span />
          <span className="is-on" />
          <span />
        </div>
        <div className="mt-ppt__slide">
          <span className="mt-line mt-line--title" />
          {step === 0 ? (
            <>
              <div className="mt-frame">
                <Logo size={22} />
              </div>
            </>
          ) : (
            <div className="mt-frame mt-frame--open">
              <QfCard>
                <span className="mt-row mt-row--pick">
                  Photosynthèse <b>Choisir</b>
                </span>
                <span className="mt-row">
                  Avis sur le cours <b>Choisir</b>
                </span>
                <span className="mt-launch">Lancer la session</span>
              </QfCard>
            </div>
          )}
        </div>
      </div>
      {step === 0 && (
        <div className="mt-menu mt-menu--ppt">
          <span>Mes compléments</span>
          <span className="mt-menu__qf">
            <Logo size={12} /> QuizFlow
          </span>
        </div>
      )}
      <Cursor />
    </div>
  )
}

function TeamsScene({ step }: { step: number }) {
  return (
    <div className="mt-win mt-win--teams">
      <div className="mt-win__bar">
        <span className="mt-app mt-app--teams">T</span>
        <i>Réunion de cours</i>
        <b className="mt-apps-btn">+ Applications</b>
      </div>
      <div className="mt-meet">
        <div className="mt-meet__stage">
          {step === 2 ? (
            <div className="mt-meet__shared">
              <QfCard>
                <strong className="mt-q">Que rejettent les plantes ?</strong>
                <Bars />
              </QfCard>
            </div>
          ) : (
            <div className="mt-tiles">
              {['YH', 'IE', 'AB', 'SK'].map((n, i) => (
                <span key={n} style={{ background: `var(--c${i})` }}>
                  {n}
                </span>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="mt-avatars">
              {['YH', 'IE', 'AB', 'SK'].map((n, i) => (
                <span key={n} style={{ background: `var(--c${i})`, animationDelay: `${1.4 + i * 0.3}s` }}>
                  ✓
                </span>
              ))}
            </div>
          )}
        </div>
        {step === 0 && (
          <div className="mt-menu mt-menu--teams">
            <span className="mt-menu__qf">
              <Logo size={12} /> QuizFlow
            </span>
            <span>Autres applications</span>
          </div>
        )}
        <div className="mt-panel">
          <QfCard>
            {step === 0 && (
              <>
                <span className="mt-row">Photosynthèse <b>Lancer</b></span>
                <span className="mt-row">Avis sur le cours <b>Lancer</b></span>
              </>
            )}
            {step === 1 && (
              <>
                <span className="mt-row mt-row--pick">Photosynthèse <b>Lancer</b></span>
                <strong className="mt-code mt-code--panel">K7P2QX</strong>
                <span className="mt-launch mt-launch--late">Afficher pour tous</span>
              </>
            )}
            {step === 2 && (
              <>
                <strong className="mt-code mt-code--small">K7P2QX</strong>
                <span className="mt-launch mt-launch--done">Affiché pour tous ✓</span>
              </>
            )}
          </QfCard>
        </div>
      </div>
      <Cursor />
    </div>
  )
}
