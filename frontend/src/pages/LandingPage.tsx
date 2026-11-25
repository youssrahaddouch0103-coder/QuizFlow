import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
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

/* ---------- Illustrations (dessins simples, aux couleurs du thème) ---------- */

function QuizArt() {
  return (
    <svg viewBox="0 0 220 150" className="landing-art" aria-hidden="true">
      <ellipse cx="110" cy="80" rx="100" ry="64" fill="#e7f0db" />
      <rect x="58" y="22" width="112" height="104" rx="10" fill="#fff" stroke="#1b2a4a" strokeWidth="3" />
      <rect x="72" y="36" width="62" height="7" rx="3.5" fill="#2f5d9e" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(72 ${56 + i * 22})`}>
          <rect width="14" height="14" rx="3" fill={i === 0 ? '#b5d38a' : '#fff'} stroke="#1b2a4a" strokeWidth="2.5" />
          {i === 0 && <path d="M3 7l3 3 5-6" fill="none" stroke="#1b2a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          <rect x="22" y="3" width={i === 0 ? 58 : 48 - i * 6} height="8" rx="4" fill={i === 0 ? '#5e7f2e' : '#c9d6e8'} />
        </g>
      ))}
      <circle cx="170" cy="118" r="20" fill="#b5d38a" stroke="#1b2a4a" strokeWidth="3" />
      <path d="M161 118l6 6 12-13" fill="none" stroke="#1b2a4a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PollArt() {
  return (
    <svg viewBox="0 0 220 150" className="landing-art" aria-hidden="true">
      <ellipse cx="110" cy="80" rx="100" ry="64" fill="#e7f0db" />
      <rect x="36" y="30" width="118" height="70" rx="12" fill="#fff" stroke="#1b2a4a" strokeWidth="3" />
      <path d="M58 100l-6 16 22-16" fill="#fff" stroke="#1b2a4a" strokeWidth="3" strokeLinejoin="round" />
      <rect x="52" y="46" width="78" height="9" rx="4.5" fill="#1b2a4a" />
      <rect x="52" y="62" width="56" height="9" rx="4.5" fill="#5e7f2e" />
      <rect x="52" y="78" width="34" height="9" rx="4.5" fill="#2f5d9e" />
      <rect x="150" y="70" width="44" height="64" rx="9" fill="#1b2a4a" />
      <rect x="156" y="80" width="32" height="10" rx="3" fill="#b5d38a" />
      <rect x="156" y="95" width="32" height="10" rx="3" fill="#c9d6e8" />
      <rect x="156" y="110" width="32" height="10" rx="3" fill="#c9d6e8" />
    </svg>
  )
}

/* ---------- Maquettes des trois étapes ---------- */

function MockEditor() {
  return (
    <div className="mock mock--editor" aria-hidden="true">
      <div className="mock__bar"><b>QuizFlow</b><span>Chapitre 3 : les piles</span><i className="mock__btn">Lancer la session</i></div>
      <div className="mock__body">
        <div className="mock__side">
          <i className="mock__btn mock__btn--light">+ Ajouter une question</i>
          {['Quel principe suit une pile ?', 'Que renvoie depiler() ?', 'Une file est…'].map((t, i) => (
            <span key={t} className={i === 0 ? 'is-on' : ''}>{i + 1}. {t}</span>
          ))}
        </div>
        <div className="mock__main">
          <small>Question 1 · Choix unique</small>
          <strong>Quel principe suit une pile ?</strong>
          {['Dernier entré, premier sorti', 'Premier entré, premier sorti', 'Aléatoire'].map((t, i) => (
            <span key={t} className={`mock__choice ${i === 0 ? 'is-good' : ''}`}><em>{LETTERS[i]}</em>{t}{i === 0 && <b>✓</b>}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockLobby() {
  return (
    <div className="mock mock--lobby" aria-hidden="true">
      <div className="mock__qr">
        <svg viewBox="0 0 21 21" shapeRendering="crispEdges">
          <path fill="currentColor" d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2zM8 0h2v2H8zM11 1h2v3h-2zM8 3h2v2H8zM9 6h3v2H9zM8 9h2v3H8zM11 9h3v2h-3zM15 8h2v3h-2zM18 9h3v2h-3zM0 8h3v2H0zM4 9h3v2H4zM12 12h2v2h-2zM15 12h3v3h-3zM19 13h2v2h-2zM8 13h3v2H8zM9 16h3v2H9zM13 15h2v3h-2zM8 19h4v2H8zM16 17h2v4h-2zM19 17h2v2h-2zM13 19h2v2h-2z" />
        </svg>
      </div>
      <div className="mock__lobby-text">
        <small>Scannez le QR code ou entrez le code</small>
        <strong>K4P2ZQ</strong>
        <span>24 participants</span>
        <div className="mock__chips">{['Salma', 'Amine', 'Hiba', 'Omar', 'Nour', 'Yassine'].map((n) => <i key={n}>{n}</i>)}</div>
      </div>
    </div>
  )
}

function MockResults() {
  return (
    <div className="mock mock--results" aria-hidden="true">
      <div className="mock__kpis">
        <span><b>24</b>participants</span>
        <span><b>78 %</b>de réussite</span>
      </div>
      <div className="mock__podium">
        {[['Salma', 9, 1], ['Amine', 8, 2], ['Hiba', 8, 2]].map(([n, s, r]) => (
          <span key={n as string}><em>{r}</em>{n}<b>{s} pts</b></span>
        ))}
      </div>
      <div className="mock__bars">
        {[71, 14, 11, 4].map((v, i) => (
          <span key={i}><em style={{ background: `var(--c${i})` }}>{LETTERS[i]}</em><i style={{ width: `${v}%`, background: `var(--c${i})` }} /><b>{v} %</b></span>
        ))}
      </div>
    </div>
  )
}

const STEPS: { title: string; text: string; icon: ReactNode; mock: ReactNode }[] = [
  {
    title: 'Préparer',
    text: 'Écrivez vos questions ou générez-les à partir de votre cours avec l’IA.',
    icon: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
    mock: <MockEditor />,
  },
  {
    title: 'Inviter la classe',
    text: 'Projetez le QR code : les élèves rejoignent depuis leur téléphone, sans compte.',
    icon: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" />,
    mock: <MockLobby />,
  },
  {
    title: 'Voir les résultats',
    text: 'Pourcentages en direct, classement en fin de séance, historique et export.',
    icon: <path d="M4 18l5-6 4 3 7-9M15 6h5v5" />,
    mock: <MockResults />,
  },
]

export default function LandingPage() {
  const { teacher } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [replay, setReplay] = useState(0)
  const [step, setStep] = useState(0)

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

  const startLink = teacher ? '/dashboard' : '/register'

  return (
    <div className="landing">
      <header className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-wrap landing-nav__inner">
          <Link to="/" className="brand landing-brand">
            <Logo size={32} /> QuizFlow
          </Link>
          <nav className="landing-nav__links" aria-label="Sections">
            <a href="#facons">Quiz et sondages</a>
            <a href="#etapes">Comment ça marche</a>
            <a href="#ia">Assistant IA</a>
          </nav>
          <div className="landing-nav__actions">
            <ThemeToggle />
            {teacher ? (
              <Link to="/dashboard" className="btn btn-primary">
                Mon espace
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
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
          <div className="landing-wrap landing-hero__inner">
            <form className="landing-join" onSubmit={join}>
              <label htmlFor="landing-code">Rejoindre une session</label>
              <input
                id="landing-code"
                className="input"
                placeholder="Code à 6 caractères"
                autoComplete="off"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
              <button className="btn btn-accent" disabled={code.length !== 6}>
                Rejoindre
              </button>
              <Link to="/join" className="landing-join__scan">
                Scanner un QR code
              </Link>
            </form>

            <h1>
              Faites participer <span>toute la classe.</span>
            </h1>
            <p className="landing-lead">Quiz et sondages en direct : les élèves répondent sur leur téléphone, les résultats s’affichent aussitôt.</p>
            <Link to={startLink} className="btn btn-primary btn-lg">
              {teacher ? 'Aller à mon espace →' : 'Créer mon premier quiz →'}
            </Link>
          </div>

          <div className="landing-wrap landing-demo">
            <div className="landing-demo__frame">
              <LiveScene key={replay} />
            </div>
            <div className="landing-demo__caption">
              <span>Quiz et sondage en direct</span>
              <button type="button" className="landing-link-btn" onClick={() => setReplay((r) => r + 1)}>
                Rejouer
              </button>
            </div>
          </div>
        </section>

        <section id="facons" className="landing-section landing-section--tint">
          <div className="landing-wrap">
            <h2>Deux façons de faire participer</h2>
            <div className="landing-ways">
              <Link to={teacher ? '/activities/new?type=QUIZ' : '/register'} className="landing-way">
                <div>
                  <h3>Quiz</h3>
                  <p>Vérifiez les acquis : bonnes réponses, points et classement.</p>
                </div>
                <QuizArt />
              </Link>
              <Link to={teacher ? '/activities/new?type=SONDAGE' : '/register'} className="landing-way landing-way--poll">
                <div>
                  <h3>Sondages</h3>
                  <p>Recueillez l’avis de la classe : nuage de mots, notes, classement, questions du public.</p>
                </div>
                <PollArt />
              </Link>
            </div>
          </div>
        </section>

        <section id="etapes" className="landing-section">
          <div className="landing-wrap">
            <h2 className="landing-h2-left">De la première question aux résultats</h2>
            <div className="landing-steps">
              <div className="landing-steps__visual">
                {STEPS[step].mock}
                <div className="landing-steps__pager">
                  <button type="button" className="btn btn-outline" onClick={() => setStep((s) => (s + STEPS.length - 1) % STEPS.length)}>
                    Précédent
                  </button>
                  <span>
                    {step + 1} / {STEPS.length}
                  </span>
                  <button type="button" className="btn btn-outline" onClick={() => setStep((s) => (s + 1) % STEPS.length)}>
                    Suivant
                  </button>
                </div>
              </div>
              <div className="landing-accordion">
                {STEPS.map((s, i) => (
                  <div key={s.title} className={`landing-accordion__item ${i === step ? 'is-open' : ''}`}>
                    <button type="button" aria-expanded={i === step} onClick={() => setStep(i)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {s.icon}
                      </svg>
                      <span>{s.title}</span>
                      <i aria-hidden="true">⌄</i>
                    </button>
                    {i === step && <p>{s.text}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="ia" className="landing-section landing-ai">
          <div className="landing-wrap landing-ai__inner">
            <div>
              <h2>Votre cours devient un quiz</h2>
              <p>Collez un texte ou importez un PDF : l’IA propose des questions avec la page source. Vous gardez celles qui vous conviennent.</p>
            </div>
            <Link to={startLink} className="btn btn-accent btn-lg">
              Essayer l’assistant →
            </Link>
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
