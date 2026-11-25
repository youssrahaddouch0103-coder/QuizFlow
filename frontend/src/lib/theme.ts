/** Thème clair / sombre. Sans choix enregistré, on suit le réglage de l'ordinateur ou du téléphone. */
export type Theme = 'light' | 'dark'

const KEY = 'qf-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function currentTheme(): Theme {
  return saved() ?? (media().matches ? 'dark' : 'light')
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e1524' : '#1b2a4a')
  window.dispatchEvent(new CustomEvent('qf-theme', { detail: theme }))
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* navigation privée : le choix ne sera pas retenu */
  }
  apply(theme)
}

/** À appeler une fois au démarrage : applique le thème et suit les changements du système. */
export function initTheme() {
  apply(currentTheme())
  media().addEventListener('change', () => {
    if (!saved()) apply(currentTheme())
  })
}
