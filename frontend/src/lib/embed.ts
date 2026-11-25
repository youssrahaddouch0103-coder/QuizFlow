/**
 * QuizFlow ouvert dans une autre application Microsoft :
 *  - Teams (onglet de réunion)  -> SDK @microsoft/teams-js, chargé seulement dans Teams ;
 *  - PowerPoint (complément)    -> office.js, chargé seulement sur la page /office.
 */
import type * as TeamsSdk from '@microsoft/teams-js'

export type Host = 'teams' | 'office' | null

const KEY = 'qf-host'

export function currentHost(): Host {
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'teams' || v === 'office' ? v : null
  } catch {
    return null
  }
}

let teamsSdk: Promise<typeof TeamsSdk | null> | null = null

/** Initialise le SDK Teams (une seule fois). Renvoie null hors de Teams. */
export function teams(): Promise<typeof TeamsSdk | null> {
  if (!teamsSdk) {
    teamsSdk = import('@microsoft/teams-js')
      .then(async (sdk) => {
        await sdk.app.initialize()
        sdk.app.notifySuccess()
        return sdk
      })
      .catch(() => null)
  }
  return teamsSdk
}

/** Au démarrage : ?host=teams (dans les adresses du manifeste Teams) est retenu pour toute la visite. */
export function initHost() {
  const asked = new URLSearchParams(window.location.search).get('host')
  if (asked === 'teams' || asked === 'office') {
    try {
      sessionStorage.setItem(KEY, asked)
    } catch {
      /* stockage indisponible : tant pis, la page courante marche quand même */
    }
  }
  if (asked === 'teams' || currentHost() === 'teams') void teams()
}

// ---------- PowerPoint ----------

/** Le strict nécessaire de l'API office.js utilisé par QuizFlow. */
interface OfficeSettings {
  get(name: string): unknown
  set(name: string, value: unknown): void
  saveAsync(callback?: (result: { status: string }) => void): void
}
interface OfficeGlobal {
  onReady(): Promise<{ host: string | null; platform: string | null }>
  context: { document: { settings: OfficeSettings } }
}

let officeSdk: Promise<OfficeGlobal | null> | null = null

/** Charge office.js et attend Office.onReady. Renvoie null si la page n'est pas dans PowerPoint. */
export function office(): Promise<OfficeGlobal | null> {
  if (!officeSdk) {
    officeSdk = new Promise((resolve) => {
      // office.js efface pushState / replaceState dans certaines versions d'Office : on les remet (React Router en a besoin).
      const push = window.history.pushState
      const replace = window.history.replaceState
      const script = document.createElement('script')
      script.src = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js'
      script.onerror = () => resolve(null)
      script.onload = () => {
        window.history.pushState = push
        window.history.replaceState = replace
        const sdk = (window as unknown as { Office?: OfficeGlobal }).Office
        if (!sdk) return resolve(null)
        const timeout = window.setTimeout(() => resolve(null), 8000)
        sdk
          .onReady()
          .then((info) => {
            window.clearTimeout(timeout)
            resolve(info.host ? sdk : null)
          })
          .catch(() => resolve(null))
      }
      document.head.appendChild(script)
    })
  }
  return officeSdk
}
