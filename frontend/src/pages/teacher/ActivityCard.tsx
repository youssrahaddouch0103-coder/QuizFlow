import type { ReactNode } from 'react'
import type { Activity } from '../../api/types'
import { StatusBadge } from '../../components/ui'
import { formatDate, typeLabel } from '../../lib/format'

export default function ActivityCard({ activity, children }: { activity: Activity; children: ReactNode }) {
  return (
    <article className="card activity-card dashboard-card">
      <div className="row">
        <span className="badge badge-primary">{typeLabel[activity.type]}</span>
        <StatusBadge status={activity.status} />
        {activity.locked && <span className="badge">Déjà utilisée</span>}
      </div>
      <h2>{activity.title || 'Sans titre'}</h2>
      <p className="muted small">
        {activity.questionCount} {activity.questionCount === 1 ? 'question' : 'questions'}
        {activity.updatedAt && <> · Modifiée le <time dateTime={activity.updatedAt}>{formatDate(activity.updatedAt)}</time></>}
      </p>
      {activity.locked && <p className="muted small">Pour modifier cette activité, dupliquez-la.</p>}
      {activity.status === 'BROUILLON' && activity.errors.length > 0 && (
        <p className="small dashboard-card-note">{activity.errors[0]}</p>
      )}
      <div className="actions">{children}</div>
    </article>
  )
}
