import { useEffect, useState } from 'react'
import type { QuestionLive } from '../api/types'

/**
 * Secondes restantes du minuteur de la question (null = pas de minuteur).
 * Le serveur envoie le temps restant ; on compte à partir de la réception, ce qui évite
 * les écarts d'horloge entre le serveur et les téléphones des étudiants.
 */
export function useCountdown(question: QuestionLive | null | undefined, running: boolean): number | null {
  const remainingMs = question?.remainingMs
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setDeadline(running && remainingMs != null ? Date.now() + remainingMs : null)
  }, [question?.id, remainingMs, running])

  useEffect(() => {
    if (deadline == null) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [deadline])

  if (deadline == null) return null
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
