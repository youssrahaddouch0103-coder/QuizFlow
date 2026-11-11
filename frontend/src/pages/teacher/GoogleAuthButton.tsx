import { useEffect, useRef, useState } from 'react'
import { errorMessage, request } from '../../api/client'
import type { AuthResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { ErrorAlert } from '../../components/ui'

type GoogleChallenge = { clientId: string; nonce: string }

interface GoogleIdentity {
  initialize(options: {
    client_id: string
    nonce: string
    callback: (response: { credential: string }) => void
  }): void
  renderButton(element: HTMLElement, options: {
    theme: 'outline'
    size: 'medium'
    text: 'continue_with'
    locale: 'fr'
  }): void
}

const identity = () =>
  (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id

let scriptLoad: Promise<GoogleIdentity> | undefined

function loadIdentity(): Promise<GoogleIdentity> {
  const loaded = identity()
  if (loaded) return Promise.resolve(loaded)
  if (!scriptLoad) {
    scriptLoad = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      const fail = () => {
        script.remove()
        reject(new Error('Impossible de charger la connexion Google.'))
      }
      script.onerror = fail
      script.onload = () => {
        const api = identity()
        if (api) resolve(api)
        else fail()
      }
      document.head.append(script)
    }).catch((error: unknown) => {
      scriptLoad = undefined
      throw error
    })
  }
  return scriptLoad
}

export default function GoogleAuthButton({ disabled }: { disabled: boolean }) {
  const { completeGoogleLogin } = useAuth()
  const button = useRef<HTMLDivElement>(null)
  const submitLock = useRef(false)
  const generation = useRef(0)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function openSession(credential: string, version: number) {
    if (submitLock.current || generation.current !== version) return
    submitLock.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await request<AuthResponse>('/api/auth/google/session', {
        method: 'POST', body: { credential }, auth: false,
      })
      if (generation.current === version) completeGoogleLogin(result)
    } catch (err) {
      if (generation.current !== version) return
      setError(errorMessage(err))
      setReady(false)
    } finally {
      submitLock.current = false
      if (generation.current === version) setBusy(false)
    }
  }

  const openSessionRef = useRef(openSession)
  useEffect(() => { openSessionRef.current = openSession })

  useEffect(() => {
    const version = ++generation.current
    let active = true
    const element = button.current
    if (!element) return

    async function prepare() {
      try {
        const challenge = await request<GoogleChallenge | undefined>('/api/auth/google/challenge', {
          method: 'POST', body: {}, auth: false,
        })
        if (!active || !challenge) return
        setEnabled(true)
        const api = await loadIdentity()
        if (!active || !element) return
        api.initialize({
          client_id: challenge.clientId,
          nonce: challenge.nonce,
          callback: ({ credential }) => {
            if (active) void openSessionRef.current(credential, version)
          },
        })
        // Google's medium button keeps the label generic, without the account name or email.
        api.renderButton(element, { theme: 'outline', size: 'medium', text: 'continue_with', locale: 'fr' })
        setReady(true)
      } catch {
        if (active) setError('La connexion Google est indisponible. Réessayez dans quelques instants.')
      }
    }
    void prepare()
    return () => {
      active = false
      generation.current = version + 1
      element.replaceChildren()
    }
  }, [attempt])

  function restart() {
    setError(null)
    setReady(false)
    setAttempt((value) => value + 1)
  }

  return (
    <div hidden={!enabled} className="stack" aria-busy={busy}
      style={enabled ? undefined : { display: 'none' }}>
      <span className="muted small" style={{ textAlign: 'center' }}>ou</span>
      <div ref={button} hidden={!ready}
        inert={busy || disabled} style={{ alignSelf: 'center', maxWidth: '100%' }} />
      <div aria-live="polite">
        {busy && <span className="muted small">Connexion Google en cours…</span>}
        {error && <ErrorAlert message={error} />}
      </div>
      {error && !ready && (
        <button type="button" className="btn btn-outline" onClick={restart} disabled={busy || disabled}>
          Réessayer avec Google
        </button>
      )}
    </div>
  )
}
