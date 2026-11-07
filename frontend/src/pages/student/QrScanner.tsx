import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import './QrScanner.css'

/** Extrait le code de session d'un contenu de QR code (URL .../join/ABC123 ou code seul). */
function codeFromQr(raw: string): string | null {
  const text = raw.trim()
  const fromUrl = text.match(/\/(?:join|play)\/([A-Za-z0-9]{6})(?:[/?#]|$)/)
  if (fromUrl) return fromUrl[1].toUpperCase()
  if (/^[A-Za-z0-9]{6}$/.test(text)) return text.toUpperCase()
  return null
}

/**
 * Scanner de QR code avec la caméra du téléphone.
 * jsQR lit les images du flux vidéo : fonctionne sur Android comme sur iPhone.
 * Le navigateur n'autorise la caméra qu'en HTTPS ou sur localhost.
 */
export default function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = () => {
      if (stopped) return
      const video = videoRef.current
      if (video && ctx && video.readyState >= 2 && video.videoWidth > 0) {
        // On réduit l'image pour garder une lecture fluide sur les petits téléphones.
        const scale = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (result?.data) {
          const code = codeFromQr(result.data)
          if (code) {
            stopped = true
            onCode(code)
            return
          }
          setInvalid(true)
        }
      }
      frame = requestAnimationFrame(tick)
    }

    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('La caméra n’est disponible que sur une adresse sécurisée (https). Scannez le QR code avec l’appareil photo du téléphone, ou saisissez le code.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        frame = requestAnimationFrame(tick)
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code.'
            : 'Impossible d’ouvrir la caméra. Saisissez le code affiché au tableau.',
        )
      }
    }
    void start()

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])

  return (
    <div className="qr-scanner stack">
      {error ? (
        <div className="alert alert-warning">{error}</div>
      ) : (
        <div className="qr-scanner__view">
          <video ref={videoRef} muted playsInline aria-label="Aperçu de la caméra" />
          <span className="qr-scanner__frame" aria-hidden="true" />
          <span className="qr-scanner__hint">{invalid ? 'Ce QR code ne correspond pas à une session QuizFlow' : 'Visez le QR code affiché au tableau'}</span>
        </div>
      )}
      <button type="button" className="btn btn-outline btn-block" onClick={onClose}>
        Saisir le code à la place
      </button>
    </div>
  )
}
