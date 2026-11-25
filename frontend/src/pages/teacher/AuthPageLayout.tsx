import type { ReactNode } from 'react'
import ThemeToggle from '../../components/ThemeToggle'

export default function AuthPageLayout({ mode, children }: { mode: 'login' | 'register'; children: ReactNode }) {
  return (
    <main className="qf-auth">
      <ThemeToggle className="theme-toggle--corner" />
      <section className="qf-auth__card" aria-label={mode === 'login' ? 'Connexion enseignant' : 'Inscription enseignant'}>
        {children}
      </section>
    </main>
  )
}
