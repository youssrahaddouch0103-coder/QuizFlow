type ActivitySymbolProps = {
  kind: 'quiz' | 'poll' | 'empty' | 'search'
  className?: string
}

/** Decorative pictograms. Their adjacent text provides the accessible label. */
export default function ActivitySymbol({ kind, className }: ActivitySymbolProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'quiz' ? (
        <>
          <rect x="16" y="8" width="36" height="44" rx="9" fill="currentColor" opacity=".14" transform="rotate(10 34 30)" />
          <rect x="9" y="14" width="37" height="43" rx="9" fill="var(--symbol-paper, #fff)" stroke="currentColor" strokeWidth="2.2" />
          <path d="M18 25h19M18 31h11" stroke="currentColor" strokeWidth="2.2" />
          <rect x="17" y="39" width="12" height="10" rx="3" fill="currentColor" opacity=".15" />
          <path d="m20 44 2 2 4-4" stroke="currentColor" strokeWidth="2" />
          <path d="M34 43h5M34 48h3" stroke="currentColor" strokeWidth="2" />
          <circle cx="49" cy="17" r="10" fill="var(--symbol-accent, #ffc977)" />
          <path d="m45 17 3 3 5-6" stroke="#382d25" strokeWidth="2.2" />
        </>
      ) : kind === 'poll' ? (
        <>
          <path d="M11 31h42v18a8 8 0 0 1-8 8H19a8 8 0 0 1-8-8V31Z" fill="currentColor" opacity=".14" />
          <path d="m11 31 6-11h30l6 11M11 31h42v18a8 8 0 0 1-8 8H19a8 8 0 0 1-8-8V31Z" stroke="currentColor" strokeWidth="2.2" />
          <path d="M22 32h20" stroke="currentColor" strokeWidth="3" />
          <rect x="24" y="7" width="18" height="23" rx="4" transform="rotate(12 33 19)" fill="var(--symbol-paper, #fff)" stroke="currentColor" strokeWidth="2.2" />
          <path d="m29 18 3 4 6-6" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="48" cy="46" r="11" fill="var(--symbol-accent, #b5dfd0)" />
          <path d="M43 49v-4m5 4v-8m5 8v-6" stroke="#215443" strokeWidth="2.2" />
        </>
      ) : (
        <>
          <rect x="18" y="9" width="33" height="41" rx="7" fill="currentColor" opacity=".12" transform="rotate(9 34 29)" />
          <rect x="10" y="15" width="34" height="41" rx="7" fill="var(--symbol-paper, #fff)" stroke="currentColor" strokeWidth="2.2" />
          <path d="M19 27h16M19 34h11M19 41h7" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="46" cy="43" r="11" fill="var(--symbol-accent, #ffc977)" />
          {kind === 'search' ? (
            <><circle cx="44" cy="41" r="4" stroke="#382d25" strokeWidth="2" /><path d="m47 44 4 4" stroke="#382d25" strokeWidth="2" /></>
          ) : <path d="M41 43h10m-5-5v10" stroke="#382d25" strokeWidth="2.2" />}
        </>
      )}
    </svg>
  )
}
