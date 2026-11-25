import { useEffect, useState } from 'react'
import { Logo } from '../../components/ui'
import { teams } from '../../lib/embed'
import './Embed.css'

/** Page affichée par Teams quand on ajoute QuizFlow à une réunion : il suffit de cliquer sur « Enregistrer ». */
export default function TeamsConfigPage() {
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    void teams().then((sdk) => {
      if (!sdk) return setReady(false)
      const origin = window.location.origin
      sdk.pages.config.registerOnSaveHandler((event) => {
        sdk.pages.config
          .setConfig({
            entityId: 'quizflow',
            contentUrl: `${origin}/teams?host=teams`,
            websiteUrl: origin,
            suggestedDisplayName: 'QuizFlow',
          })
          .then(() => event.notifySuccess())
          .catch((e: unknown) => event.notifyFailure(String(e)))
      })
      sdk.pages.config.setValidityState(true)
      setReady(true)
    })
  }, [])

  return (
    <main className="embed embed--panel">
      <div className="embed-card">
        <div className="brand">
          <Logo size={30} /> QuizFlow
        </div>
        <p>{ready === false ? 'Cette page s’ouvre depuis Microsoft Teams.' : 'Cliquez sur « Enregistrer » pour ajouter QuizFlow à la réunion.'}</p>
      </div>
    </main>
  )
}
