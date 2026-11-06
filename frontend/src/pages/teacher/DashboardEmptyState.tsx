import { Link } from 'react-router-dom'
import ActivitySymbol from '../../components/ActivitySymbol'

export default function DashboardEmptyState({
  firstActivity,
  onlyArchived,
  searching,
  onChangeFilter,
  onClearSearch,
}: {
  firstActivity: boolean
  onlyArchived: boolean
  searching: boolean
  onChangeFilter: () => void
  onClearSearch: () => void
}) {
  return (
    <section className="card empty dashboard-empty">
      <span className="dashboard-empty-icon"><ActivitySymbol kind={searching ? 'search' : 'empty'} /></span>
      {firstActivity ? (
        <>
          <h2>Vous n’avez pas encore créé d’activité.</h2>
          <p>Ajoutez vos questions et lancez votre activité quand elle est prête.</p>
          <Link className="btn btn-primary" to="/activities/new?type=QUIZ">Créer mon premier quiz</Link>
        </>
      ) : searching ? (
        <>
          <h2>Aucune activité ne correspond à votre recherche.</h2>
          <p>Essayez un autre titre ou effacez la recherche.</p>
          <button type="button" className="btn btn-outline" onClick={onClearSearch}>Effacer la recherche</button>
        </>
      ) : (
        <>
          <h2>{onlyArchived ? 'Toutes vos activités sont archivées.' : 'Aucune activité pour ce filtre.'}</h2>
          <button type="button" className="btn btn-outline" onClick={onChangeFilter}>
            {onlyArchived ? 'Voir les activités archivées' : 'Revenir à Toutes'}
          </button>
        </>
      )}
    </section>
  )
}
