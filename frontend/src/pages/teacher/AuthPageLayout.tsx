import { lazy, Suspense, type ReactNode } from 'react'

// Fond 3D chargé à part, pour que le formulaire s'affiche tout de suite.
const Hero3D = lazy(() => import('../Hero3D'))

export default function AuthPageLayout({ mode, children }: { mode: 'login' | 'register'; children: ReactNode }) {
  return (
    <main className="qf-auth">
      <div className="qf-auth__shell">
        <aside className="qf-auth__story" aria-label="Bienvenue sur QuizFlow">
          <div className="qf-auth__bg" aria-hidden="true">
            <Suspense fallback={null}>
              <Hero3D variant="panel" />
            </Suspense>
            <span className="qf-auth__shade" />
          </div>
          <span className="qf-auth__eyebrow">L’ESPACE DES ENSEIGNANTS</span>
          <div className="qf-auth__story-copy">
            <p className="qf-auth__headline">Chaque question.<br />Une nouvelle<br /><span>découverte.</span></p>
            <p>Donnez vie à vos cours avec des quiz interactifs qui font participer toute la classe.</p>
          </div>
          <div className="qf-auth__illustration" aria-hidden="true">
            <div className="qf-auth__quiz-top"><span>LE QUIZ DU JOUR</span><span>✦</span></div>
            <p>Prêts à apprendre ensemble ?</p>
            <div className="qf-auth__answer"><span>A</span> Explorons de nouvelles idées</div>
            <div className="qf-auth__answer qf-auth__answer--selected"><span>B</span> Faisons participer la classe <b>✓</b></div>
            <div className="qf-auth__quiz-bottom"><span>● ● ●</span> À vous de jouer !</div>
          </div>
          <p className="qf-auth__signature">Créez. Partagez. Faites progresser.</p>
        </aside>
        <section className="qf-auth__content" aria-label={mode === 'login' ? 'Connexion enseignant' : 'Inscription enseignant'}>
          <p className="qf-auth__welcome">{mode === 'login' ? 'HEUREUX DE VOUS RETROUVER' : 'UNE NOUVELLE AVENTURE COMMENCE'}</p>
          {children}
          <p className="qf-auth__footnote">Un espace pour enseigner, un plaisir d’apprendre.</p>
        </section>
      </div>
    </main>
  )
}
