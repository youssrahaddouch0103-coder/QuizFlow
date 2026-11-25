import { useEffect, useState } from 'react'
import { currentTheme, setTheme, type Theme } from '../lib/theme'

/** Bouton lune / soleil pour passer du thème clair au thème sombre. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>(currentTheme)

  useEffect(() => {
    const onChange = (e: Event) => setLocal((e as CustomEvent<Theme>).detail)
    window.addEventListener('qf-theme', onChange)
    return () => window.removeEventListener('qf-theme', onChange)
  }, [])

  const dark = theme === 'dark'
  const label = dark ? 'Passer en mode clair' : 'Passer en mode sombre'
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        )}
      </svg>
    </button>
  )
}
