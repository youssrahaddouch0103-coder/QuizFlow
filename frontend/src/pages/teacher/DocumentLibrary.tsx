import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { api } from '../../api/api'
import { errorMessage } from '../../api/client'
import type { CourseDocument } from '../../api/types'
import { Spinner } from '../../components/ui'

const MAX_MB = 20

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

/**
 * Bibliothèque de PDF de l'enseignant (RAG) : import, suivi de l'analyse, choix et suppression.
 * Un PDF importé est découpé en passages et indexé (embeddings) : on peut ensuite y revenir
 * pour générer d'autres questions sans le réimporter.
 */
export default function DocumentLibrary({ selectedId, onSelect }: { selectedId: string | null; onSelect: (doc: CourseDocument | null) => void }) {
  const [docs, setDocs] = useState<CourseDocument[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await api.listDocuments()
      setDocs(list)
      return list
    } catch (e) {
      setError(errorMessage(e))
      setDocs((d) => d ?? [])
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Tant qu'un document est en cours d'analyse, on relit la liste toutes les 2 secondes.
  const processing = docs?.some((d) => d.status === 'PROCESSING')
  useEffect(() => {
    if (!processing) return
    const t = window.setInterval(() => void refresh(), 2000)
    return () => window.clearInterval(t)
  }, [processing, refresh])

  // Garder la sélection à jour (le document passe de « en cours » à « prêt »).
  useEffect(() => {
    if (!docs) return
    const current = docs.find((d) => d.id === selectedId) ?? null
    if (selectedId && !current) onSelect(null)
    else if (current) onSelect(current)
  }, [docs, selectedId, onSelect])

  const upload = async (file: File) => {
    setError(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choisissez un fichier PDF.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Fichier trop lourd : ${MAX_MB} Mo maximum.`)
      return
    }
    setUploading(true)
    try {
      const doc = await api.uploadDocument(file)
      // Ajouter le document à la liste AVANT de le sélectionner, sinon il serait aussitôt désélectionné.
      setDocs((prev) => [doc, ...(prev ?? []).filter((x) => x.id !== doc.id)])
      onSelect(doc)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (doc: CourseDocument) => {
    setConfirmId(null)
    try {
      await api.deleteDocument(doc.id)
      if (doc.id === selectedId) onSelect(null)
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  return (
    <div className="doc-library">
      <label
        className={`doc-drop ${dragOver ? 'is-over' : ''} ${uploading ? 'is-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
        </svg>
        {uploading ? (
          <span>
            <Spinner /> Envoi du fichier…
          </span>
        ) : (
          <span>
            <span>
              <strong>Déposez un PDF</strong> ou <u>choisissez un fichier</u>
            </span>
            <small>PDF avec du texte (pas un scan), {MAX_MB} Mo maximum</small>
          </span>
        )}
      </label>

      {error && <div className="alert alert-error small">{error}</div>}

      {docs === null ? (
        <div className="doc-empty">
          <Spinner />
        </div>
      ) : docs.length === 0 ? (
        <p className="doc-empty">Votre bibliothèque est vide : importez un premier cours.</p>
      ) : (
        <ul className="doc-list" aria-label="Vos documents">
          {docs.map((d) => {
            const selected = d.id === selectedId
            return (
              <li key={d.id} className={`doc-item ${selected ? 'is-selected' : ''} is-${d.status.toLowerCase()}`}>
                <button type="button" className="doc-item__main" aria-pressed={selected} disabled={d.status === 'FAILED'} onClick={() => onSelect(selected ? null : d)}>
                  <span className="doc-item__icon" aria-hidden="true">
                    PDF
                  </span>
                  <span className="doc-item__text">
                    <strong>{d.title || d.filename}</strong>
                    <small>
                      {d.status === 'PROCESSING' && (
                        <>
                          <Spinner /> Analyse du document… {d.progress ? `${d.progress} %` : ''}
                        </>
                      )}
                      {d.status === 'READY' && `${d.pages} page${d.pages > 1 ? 's' : ''} · ${d.chunks} passage${d.chunks > 1 ? 's' : ''} · ${sizeLabel(d.sizeBytes)}`}
                      {d.status === 'FAILED' && (d.error || 'Le document n’a pas pu être analysé.')}
                    </small>
                  </span>
                </button>
                {d.status === 'PROCESSING' && (
                  <span className="doc-item__progress" aria-hidden="true">
                    <span style={{ width: `${d.progress ?? 0}%` }} />
                  </span>
                )}
                {confirmId === d.id ? (
                  <span className="doc-item__confirm">
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(d)}>
                      Supprimer
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button type="button" className="doc-item__delete" aria-label={`Supprimer ${d.title || d.filename}`} onClick={() => setConfirmId(d.id)}>
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
