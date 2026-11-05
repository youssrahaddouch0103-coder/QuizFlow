// Petit client HTTP : ajoute le jeton, transforme les erreurs du backend en ApiError.

export class ApiError extends Error {
  status: number
  code: string
  details?: { field: string; message: string }[]

  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const TOKEN_KEY = 'quizflow.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* stockage indisponible : la session reste en mémoire */
    }
  },
}

type Options = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export async function request<T>(path: string, { method = 'GET', body, headers = {}, auth = true }: Options = {}): Promise<T> {
  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  const token = auth ? tokenStore.get() : null
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(path, { method, headers: finalHeaders, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Serveur injoignable. Vérifiez votre connexion.')
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? safeJson(text) : null

  if (!res.ok) {
    if (res.status === 401 && auth && token) onUnauthorized?.()
    const d = (data ?? {}) as { code?: string; message?: string; details?: { field: string; message: string }[] }
    throw new ApiError(res.status, d.code ?? 'HTTP_' + res.status, d.message ?? 'Erreur ' + res.status, d.details)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.details?.length) return e.details.map((d) => `${d.field} : ${d.message}`).join(' · ')
    return e.message
  }
  return 'Une erreur inattendue est survenue'
}
