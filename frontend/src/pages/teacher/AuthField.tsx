import type { ReactNode } from 'react'

export default function AuthField({ icon, children }: { icon: 'user' | 'email' | 'lock'; children: ReactNode }) {
  return (
    <div className="field qf-auth__field">
      {children}
      <svg className="qf-auth__field-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {icon === 'email' && <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>}
        {icon === 'user' && <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
        {icon === 'lock' && <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></>}
      </svg>
    </div>
  )
}
