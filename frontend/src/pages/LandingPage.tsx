import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/ui'
import { LETTERS } from '../lib/format'
import './LandingPage.css'


const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ---------- Scène animée : écran projeté + téléphone ---------- */

/** Plusieurs questions d'exemple : la scène change à chaque visite et après chaque série de votes. */
const SCENES: { question: string; choices: string[]; weights: number[] }[] = [
  { question: 'Quel gaz les plantes rejettent-elles pendant la photosynthèse ?', choices: ['Oxygène', 'Dioxyde de carbone', 'Azote', 'Hydrogène'], weights: [0.62, 0.22, 0.1, 0.06] },
  { question: 'Quelle couche du modèle OSI assure le routage ?', choices: ['Liaison', 'Réseau', 'Transport', 'Session'], weights: [0.18, 0.58, 0.19, 0.05] },
  { question: 'Combien vaut la dérivée de x² ?', choices: ['x', '2x', 'x²/2', '2'], weights: [0.12, 0.7, 0.1, 0.08] },
  { question: 'Quelle structure suit le principe « premier entré, premier sorti » ?', choices: ['Pile', 'File', 'Arbre', 'Graphe'], weights: [0.3, 0.55, 0.1, 0.05] },
  { question: 'Quel métal conduit le mieux l’électricité ?', choices: ['Cuivre', 'Fer', 'Argent', 'Aluminium'], weights: [0.48, 0.07, 0.35, 0.1] },
  { question: 'En quelle année a eu lieu la Révolution française ?', choices: ['1689', '1789', '1815', '1848'], weights: [0.1, 0.72, 0.1, 0.08] },
]
const MAX_VOTES = 32
const seed = (weights: number[]) => weights.map((w) => Math.round(w * 8))

function pickChoice(weights: number[]) {
  let r = Math.random()
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return 0
}

function LiveScene() {
  const [sceneIndex, setSceneIndex] = useState(() => Math.floor(Math.random() * SCENES.length))
  const scene = SCENES[sceneIndex]
  const [votes, setVotes] = useState<number[]>(() => seed(scene.weights))
  const [tapped, setTapped] = useState<number | null>(null)
  const [pops, setPops] = useState<{ id: number; choice: number }[]>([])

  useEffect(() => {
    if (reduceMotion()) {
      setVotes(scene.weights.map((w) => Math.round(w * 24)))
      return
    }
    let id = 0
    const timer = window.setInterval(() => {
      const choice = pickChoice(scene.weights)
      id += 1
      const popId = id
      setTapped(choice)
      setPops((p) => [...p.slice(-3), { id: popId, choice }])
      setVotes((v) => v.map((n, i) => (i === choice ? n + 1 : n)))
      window.setTimeout(() => setTapped(null), 650)
      window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== popId)), 1300)
    }, 1100)
    return () => window.clearInterval(timer)
  }, [scene])

  const total = votes.reduce((a, b) => a + b, 0)

  // Une fois la série de votes terminée, on passe à une autre question.
  useEffect(() => {
    if (total < MAX_VOTES) return
    const t = window.setTimeout(() => {
      const next = (sceneIndex + 1 + Math.floor(Math.random() * (SCENES.length - 1))) % SCENES.length
      setVotes(seed(SCENES[next].weights))
      setSceneIndex(next)
    }, 1500)
    return () => window.clearTimeout(t)
  }, [total, sceneIndex])

  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-screen">
        <div className="scene-screen__top">
          <span className="scene-chip">Question {sceneIndex + 1} / {SCENES.length}</span>
          <span className="scene-live">
            <i /> En direct
          </span>
        </div>
        <p className="scene-question">{scene.question}</p>
        <ul className="scene-bars">
          {scene.choices.map((label, i) => {
            const pct = total ? Math.round((100 * votes[i]) / total) : 0
            return (
              <li key={label}>
                <span className="scene-letter" style={{ background: `var(--c${i})` }}>
                  {LETTERS[i]}
                </span>
                <span className="scene-track">
                  <span className="scene-fill" style={{ width: `${pct}%`, background: `var(--c${i})` }} />
                  <span className="scene-label">{label}</span>
                </span>
                <span className="scene-pct">{pct}%</span>
              </li>
            )
          })}
        </ul>
        <div className="scene-screen__foot">
          <span>
            <strong>{total}</strong> réponses
          </span>
          <span className="scene-qr">
            <svg viewBox="0 0 21 21" shapeRendering="crispEdges">
              <path
                fill="currentColor"
                d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2zM8 0h2v2H8zM11 1h2v3h-2zM8 3h2v2H8zM9 6h3v2H9zM8 9h2v3H8zM11 9h3v2h-3zM15 8h2v3h-2zM18 9h3v2h-3zM0 8h3v2H0zM4 9h3v2H4zM12 12h2v2h-2zM15 12h3v3h-3zM19 13h2v2h-2zM8 13h3v2H8zM9 16h3v2H9zM13 15h2v3h-2zM8 19h4v2H8zM16 17h2v4h-2zM19 17h2v2h-2zM13 19h2v2h-2z"
              />
            </svg>
            Code <b>AB12CD</b>
          </span>
        </div>
      </div>

      <div className="scene-phone">
        <div className="scene-phone__notch" />
        <span className="scene-phone__title">Votre réponse</span>
        {scene.choices.map((label, i) => (
          <span key={label} className={`scene-answer ${tapped === i ? 'is-tapped' : ''}`} style={{ background: `var(--c${i})` }}>
            {LETTERS[i]} · {label}
          </span>
        ))}
        <span className={`scene-sent ${tapped !== null ? 'is-on' : ''}`}>Réponse envoyée ✓</span>
      </div>

      <div className="scene-pops">
        {pops.map((p) => (
          <span key={p.id} className="scene-pop" style={{ background: `var(--c${p.choice})`, left: `${20 + p.choice * 18}%` }}>
            +1
          </span>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { teacher } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const join = (e: FormEvent) => {
    e.preventDefault()
    if (code.length === 6) navigate(`/join/${code}`)
  }

  return (
    <div className="landing">
      <header className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-wrap landing-nav__inner">
          <Link to="/" className="brand landing-brand">
            <Logo size={32} /> QuizFlow
          </Link>
          <div className="landing-nav__actions">
            <Link to="/join" className="btn btn-ghost landing-hide-sm">
              Rejoindre
            </Link>
            {teacher ? (
              <Link to="/dashboard" className="btn btn-primary">
                Mon espace
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">
                  Se connecter
                </Link>
                <Link to="/register" className="btn btn-primary landing-hide-sm">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-wrap landing-hero__grid">
            <div className="landing-hero__text">
              <h1>
                Toute la classe participe, <span>en direct</span>.
              </h1>
              <p className="landing-lead">Quiz et sondages en direct : les élèves répondent depuis leur téléphone.</p>
              <div className="landing-hero__cta">
                <Link to={teacher ? '/dashboard' : '/register'} className="btn btn-accent btn-lg">
                  {teacher ? 'Mon espace' : 'Créer un compte'}
                </Link>
              </div>
              <form className="landing-join" onSubmit={join}>
                <label htmlFor="landing-code">Vous êtes élève ?</label>
                <div className="landing-join__row">
                  <input
                    id="landing-code"
                    className="input"
                    placeholder="CODE"
                    autoComplete="off"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  />
                  <button className="btn btn-accent" disabled={code.length !== 6}>
                    Rejoindre
                  </button>
                </div>
                <Link to="/join" className="landing-join__scan">
                  Scanner le QR code
                </Link>
              </form>
            </div>
            <LiveScene />
          </div>
        </section>

      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer__inner">
          <span className="brand landing-brand">
            <Logo size={26} /> QuizFlow
          </span>
          <span>ENSAM Meknès · Youssra Haddouch &amp; Ikram Ech-Charqy</span>
        </div>
      </footer>
    </div>
  )
}
