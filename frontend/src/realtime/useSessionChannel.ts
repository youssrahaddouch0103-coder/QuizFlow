import { Client, type IMessage } from '@stomp/stompjs'
import { useEffect, useRef, useState } from 'react'
import type { LiveEvent } from '../api/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface Options {
  /** Code de la session (6 caractères). Rien n'est ouvert tant qu'il est vide. */
  code: string | undefined
  /** JWT de l'enseignant : donne accès au canal /teacher. */
  teacherToken?: string | null
  onEvent: (event: LiveEvent) => void
  /**
   * Appelé à chaque (re)connexion : on relit l'état depuis l'API REST,
   * car des événements ont pu être manqués pendant la coupure.
   */
  onConnected?: () => void
}

function brokerUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws`
}

/** Abonnement STOMP aux événements d'une session, avec reconnexion automatique. */
export function useSessionChannel({ code, teacherToken, onEvent, onConnected }: Options): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const onEventRef = useRef(onEvent)
  const onConnectedRef = useRef(onConnected)
  onEventRef.current = onEvent
  onConnectedRef.current = onConnected

  useEffect(() => {
    if (!code) return
    const client = new Client({
      brokerURL: brokerUrl(),
      connectHeaders: teacherToken ? { Authorization: `Bearer ${teacherToken}` } : {},
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    const handle = (msg: IMessage) => {
      try {
        onEventRef.current(JSON.parse(msg.body) as LiveEvent)
      } catch {
        /* message illisible ignoré */
      }
    }

    client.onConnect = () => {
      setStatus('connected')
      client.subscribe(`/topic/sessions/${code}`, handle)
      if (teacherToken) client.subscribe(`/topic/sessions/${code}/teacher`, handle)
      onConnectedRef.current?.()
    }
    client.onWebSocketClose = () => setStatus('disconnected')
    client.onStompError = () => setStatus('disconnected')

    setStatus('connecting')
    client.activate()
    return () => {
      void client.deactivate()
    }
  }, [code, teacherToken])

  return status
}
