import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/ui'
import { LETTERS } from '../lib/format'
import './LandingPage.css'

const Hero3D = lazy(() => import('./Hero3D'))

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Fait apparaître son contenu quand il entre à l'écran. */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ---------- Scène animée : écran projeté + téléphone ---------- */

const DEMO_CHOICES = ['Oxygène', 'Dioxyde de carbone', 'Azote', 'Hydrogène']
const WEIGHTS = [0.62, 0.22, 0.1, 0.06]
const MAX_VOTES = 32

function pickChoice() {
  let r = Math.random()
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i]
    if (r <= 0) return i
  }
  return 0
}

function LiveScene() {
  const [votes, setVotes] = useState<number[]>([9, 3, 1, 1])
  const [tapped, setTapped] = useState<number | null>(null)
  const [pops, setPops] = useState<{ id: number; choice: number }[]>([])

  useEffect(() => {
    if (reduceMotion()) return
    let id = 0
    const timer = window.setInterval(() => {
      const choice = pickChoice()
      id += 1
      const popId = id
      setTapped(choice)
      setPops((p) => [...p.slice(-3), { id: popId, choice }])
      setVotes((v) => (v.reduce((a, b) => a + b, 0) >= MAX_VOTES ? [1, 0, 0, 0] : v.map((n, i) => (i === choice ? n + 1 : n))))
      window.setTimeout(() => setTapped(null), 650)
      window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== popId)), 1300)
    }, 1100)
    return () => window.clearInterval(timer)
  }, [])

  const total = votes.reduce((a, b) => a + b, 0)

  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-screen">
        <div className="scene-screen__top">
          <span className="scene-chip">Question 2 / 5</span>
          <span className="scene-live">
            <i /> En direct
          </span>
        </div>
        <p className="scene-question">Quel gaz les plantes rejettent-elles pendant la photosynthèse ?</p>
        <ul className="scene-bars">
          {DEMO_CHOICES.map((label, i) => {
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
        {DEMO_CHOICES.map((label, i) => (
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

/* ---------- Démo IA : texte → questions ---------- */

function AiDemo() {
  return (
    <div className="ai-demo" aria-hidden="true">
      <div className="ai-demo__doc">
        <span className="ai-demo__tag">Votre cours</span>
        <p>
          La photosynthèse permet aux plantes de fabriquer leur matière à partir de la lumière. Elles absorbent le dioxyde de carbone et rejettent de
          l’oxygène…
        </p>
        <span className="ai-demo__scan" />
      </div>
      <div className="ai-demo__arrow">→</div>
      <div className="ai-demo__questions">
        {['Que rejettent les plantes ?', 'Quelle énergie utilise la photosynthèse ?', 'Quel gaz est absorbé ?'].map((q, i) => (
          <div key={q} className="ai-demo__q" style={{ animationDelay: `${0.9 + i * 0.45}s` }}>
            <span className="ai-demo__num">{i + 1}</span>
            {q}
            <span className="ai-demo__ok">Ajouter</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Icônes ---------- */

const icons = {
  create: <path d="M5 19h14M7 15l8.5-8.5a2 2 0 0 1 3 3L10 18H7z" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2M18 18h2v2h-2" />,
  live: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ai: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  phone: <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2" />,
  podium: <path d="M3 20h18M5 20v-6h4v6M10 20V9h4v11M15 20v-8h4v8M12 3l1 2 2 .3-1.5 1.4.4 2.1L12 7.8l-1.9 1 .4-2.1L9 5.3l2-.3z" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2" />,
  poll: <path d="M4 6h16M4 12h10M4 18h6" />,
}

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

const STEPS: { icon: keyof typeof icons; title: string; text: string }[] = [
  { icon: 'create', title: 'Préparez', text: 'Écrivez vos questions ou laissez l’IA les proposer à partir de votre cours.' },
  { icon: 'qr', title: 'Projetez', text: 'Lancez la session : un QR code et un code à 6 caractères s’affichent au tableau.' },
  { icon: 'live', title: 'Animez', text: 'Les élèves répondent sur leur téléphone, les pourcentages bougent en direct.' },
]

const FEATURES: { icon: keyof typeof icons; title: string; text: string }[] = [
  { icon: 'ai', title: 'Questions générées par l’IA', text: 'Collez un extrait de cours, l’IA propose des questions. Vous gardez celles qui vous conviennent.' },
  { icon: 'phone', title: 'Sans compte pour les élèves', text: 'Un scan ou un code, un pseudo, et c’est parti. Rien à installer.' },
  { icon: 'poll', title: 'Quiz et sondages', text: 'Testez les connaissances ou recueillez l’avis de la classe, en choix unique ou multiple.' },
  { icon: 'podium', title: 'Classement et podium', text: 'Les points récompensent les bonnes réponses : de quoi motiver toute la classe.' },
  { icon: 'live', title: 'Résultats détaillés', text: 'Après la séance, retrouvez les réponses par question pour voir ce qui reste à revoir.' },
  { icon: 'history', title: 'Historique des séances', text: 'Toutes vos sessions passées restent accessibles depuis votre espace.' },
]

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
          <nav className="landing-nav__links" aria-label="Sections">
            <a href="#comment">Comment ça marche</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#ia">L’IA</a>
          </nav>
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
          <div className="landing-hero__bg" aria-hidden="true">
            <Suspense fallback={null}>
              <Hero3D />
            </Suspense>
            <span className="landing-hero__shade" />
            <span className="landing-hero__glow" />
            <span className="landing-hero__grid-lines" />
          </div>
          <div className="landing-wrap landing-hero__grid">
            <div className="landing-hero__text">
              <span className="landing-chip">Quiz et sondages en direct pour la classe</span>
              <h1>
                Toute la classe participe, <span>en direct</span>.
              </h1>
              <p className="landing-lead">
                Projetez une question, vos élèves répondent depuis leur téléphone et les résultats s’affichent en temps réel. Préparer un quiz ne prend que
                quelques minutes, grâce à l’IA.
              </p>
              <div className="landing-hero__cta">
                <Link to={teacher ? '/dashboard' : '/register'} className="btn btn-accent btn-lg">
                  {teacher ? 'Aller à mon espace →' : 'Créer mon premier quiz →'}
                </Link>
                <a href="#comment" className="btn landing-btn-ghost btn-lg">
                  Voir comment ça marche
                </a>
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
                  ou scannez le QR code →
                </Link>
              </form>
            </div>
            <LiveScene />
          </div>
        </section>

        <section id="comment" className="landing-section">
          <div className="landing-wrap">
            <Reveal className="landing-head">
              <span className="landing-eyebrow">Comment ça marche</span>
              <h2>Trois étapes, zéro installation</h2>
            </Reveal>
            <div className="landing-steps">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 120} className="landing-step">
                  <span className="landing-step__num">{i + 1}</span>
                  <span className="landing-icon">
                    <Icon name={s.icon} />
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="ia" className="landing-section landing-ai">
          <div className="landing-wrap landing-ai__grid">
            <Reveal className="landing-ai__text">
              <span className="landing-eyebrow landing-eyebrow--light">Assistant de questions</span>
              <h2>
                Votre cours devient un quiz en <span>30 secondes</span>.
              </h2>
              <p>
                Collez un passage de votre cours : l’IA propose des questions et leurs réponses, en s’appuyant uniquement sur votre contenu. Vous relisez,
                vous gardez, vous lancez.
              </p>
              <p className="landing-ai__soon">Bientôt : importez directement vos PDF.</p>
            </Reveal>
            <Reveal delay={150}>
              <AiDemo />
            </Reveal>
          </div>
        </section>

        <section id="fonctionnalites" className="landing-section">
          <div className="landing-wrap">
            <Reveal className="landing-head">
              <span className="landing-eyebrow">Fonctionnalités</span>
              <h2>Tout ce qu’il faut pour une classe qui participe</h2>
            </Reveal>
            <div className="landing-features">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 100} className="landing-feature">
                  <span className="landing-icon">
                    <Icon name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-wrap">
            <Reveal className="landing-final">
              <h2>Prêt pour votre prochain cours ?</h2>
              <p>Créez votre compte, préparez un quiz et projetez-le dès aujourd’hui.</p>
              <div className="landing-hero__cta">
                <Link to={teacher ? '/dashboard' : '/register'} className="btn btn-accent btn-lg">
                  {teacher ? 'Aller à mon espace →' : 'Créer un compte enseignant →'}
                </Link>
                <Link to="/join" className="btn landing-btn-ghost btn-lg">
                  Rejoindre une session
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer__inner">
          <span className="brand landing-brand">
            <Logo size={26} /> QuizFlow
          </span>
          <span>Projet d’initiation · ENSAM Meknès · Youssra Haddouch &amp; Ikram Ech-Charqy</span>
        </div>
      </footer>
    </div>
  )
}
