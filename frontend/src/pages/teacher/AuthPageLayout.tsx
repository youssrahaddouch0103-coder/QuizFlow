import type { ReactNode } from 'react'

export default function AuthPageLayout({ mode, children }: { mode: 'login' | 'register'; children: ReactNode }) {
  return (
    <main className="qf-auth">
      <section className="qf-auth__card" aria-label={mode === 'login' ? 'Connexion enseignant' : 'Inscription enseignant'}>
        {children}
      </section>
    </main>
  )
}
