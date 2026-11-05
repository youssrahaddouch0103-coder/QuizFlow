// Jeton de l'étudiant, gardé dans le navigateur pour pouvoir se reconnecter (W4).

export interface PlayerIdentity {
  participantId: string
  pseudo: string
  token: string
}

const key = (code: string) => `quizflow.player.${code.toUpperCase()}`

export const playerStore = {
  get(code: string): PlayerIdentity | null {
    try {
      const raw = localStorage.getItem(key(code))
      return raw ? (JSON.parse(raw) as PlayerIdentity) : null
    } catch {
      return null
    }
  },
  set(code: string, identity: PlayerIdentity) {
    try {
      localStorage.setItem(key(code), JSON.stringify(identity))
    } catch {
      /* stockage indisponible */
    }
  },
  clear(code: string) {
    try {
      localStorage.removeItem(key(code))
    } catch {
      /* rien */
    }
  },
}
