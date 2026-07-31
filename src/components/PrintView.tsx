import type { Song } from '../types/song'

interface PrintViewProps {
  song: Song
  onBack: () => void
}

export function PrintView({ song, onBack }: PrintViewProps) {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-8">
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
        >
          ← 편집
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1408] hover:bg-[#f0c868]"
        >
          인쇄 / PDF
        </button>
        <span className="text-xs text-[var(--muted)]">A4 한 장 기준</span>
      </div>

      <article className="print-sheet paper mx-auto w-full max-w-[210mm] rounded-sm border border-[var(--paper-line)] px-8 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <header className="mb-6 border-b border-[var(--paper-line)] pb-4">
          <h1 className="brand-mark text-3xl font-bold tracking-tight">{song.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--paper-ink)]/70">
            {song.artist && <span>{song.artist}</span>}
            {song.key && <span>Key {song.key}</span>}
            {song.bpm != null && <span>{song.bpm} BPM</span>}
            {song.timeSignature && <span>{song.timeSignature}</span>}
          </div>
        </header>

        <div className="flex flex-col gap-5">
          {song.sections.map((section) => (
            <section key={section.id}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <h2 className="text-sm font-bold tracking-wide uppercase">
                  {section.name}
                </h2>
                {section.repeat > 1 && (
                  <span className="chord-font text-sm font-semibold">x{section.repeat}</span>
                )}
                {section.note && (
                  <span className="text-xs text-[var(--paper-ink)]/60">
                    ({section.note})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-end">
                {section.chords.map((chord, index) => (
                  <div
                    key={`${section.id}-print-${index}`}
                    className="mb-1 flex w-[4.25rem] flex-col items-center border-r border-[var(--paper-line)] last:border-r-0"
                  >
                    <div className="chord-font min-h-[1.5rem] text-center text-base font-semibold">
                      {chord || '—'}
                    </div>
                    <div className="mt-1 h-px w-full bg-[var(--paper-ink)]" />
                    <div className="mt-0.5 h-2 w-px bg-[var(--paper-ink)]/60" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-8 border-t border-[var(--paper-line)] pt-3 text-[10px] tracking-[0.14em] text-[var(--paper-ink)]/45 uppercase">
          OneSheet
        </footer>
      </article>
    </div>
  )
}
