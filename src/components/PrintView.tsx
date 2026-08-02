import { AnalyticsEvents } from '../firebase/analytics'
import { chunkBars } from '../lib/bars'
import type { Song } from '../types/song'

interface PrintViewProps {
  song: Song
  onBack: () => void
}

export function PrintView({ song, onBack }: PrintViewProps) {
  const partMap = new Map(song.parts.map((part) => [part.id, part]))

  return (
    <div className="px-3 py-4 pb-10 sm:px-8 sm:py-6">
      <div className="no-print mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
        >
          ← 편집
        </button>
        <button
          type="button"
          onClick={() => {
            void AnalyticsEvents.print()
            window.print()
          }}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1408] hover:bg-[#f0c868]"
        >
          인쇄 / PDF
        </button>
      </div>

      <article className="print-sheet paper mx-auto w-full max-w-[210mm] rounded-sm border border-[var(--paper-line)] px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:px-8 sm:py-8">
        <header className="mb-5 border-b border-[var(--paper-line)] pb-3 sm:mb-6 sm:pb-4">
          <h1 className="brand-mark text-2xl font-bold tracking-tight sm:text-3xl">
            {song.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--paper-ink)]/70">
            {song.artist && <span>{song.artist}</span>}
            {song.key && <span>Key {song.key}</span>}
            {song.bpm != null && <span>{song.bpm} BPM</span>}
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:gap-5">
          {song.parts.map((part) => {
            const rows = chunkBars(
              part.chords.map((chord, index) => ({ chord, index })),
            )
            return (
              <section key={part.id} className="flex items-start gap-2 sm:gap-3">
                <h2 className="brand-mark w-7 shrink-0 pt-1 text-xl font-bold sm:w-10 sm:text-2xl">
                  {part.label}
                </h2>
                <div className="min-w-0 flex-1 space-y-2">
                  {rows.map((row) => (
                    <div
                      key={`${part.id}-row-${row[0].index}`}
                      className="bar-row grid w-full grid-cols-4"
                    >
                      {row.map(({ chord, index }) => (
                        <div
                          key={`${part.id}-print-${index}`}
                          className="flex min-w-0 flex-col items-center border-r border-[var(--paper-line)] px-0.5 last:border-r-0"
                        >
                          <div className="chord-font flex min-h-[1.4rem] w-full items-end justify-center text-center text-sm font-semibold leading-tight sm:min-h-[1.5rem] sm:text-base">
                            <span className="max-w-full truncate">
                              {chord || '—'}
                            </span>
                          </div>
                          <div className="mt-1 h-px w-full bg-[var(--paper-ink)]" />
                          <div className="mt-0.5 h-2 w-px bg-[var(--paper-ink)]/60" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <section className="border-t border-[var(--paper-line)] pt-4">
          <h2 className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--paper-ink)]/50 uppercase">
            Form
          </h2>
          <p className="chord-font text-base font-semibold leading-relaxed sm:text-lg">
            {song.form
              .map((step) => {
                const part = partMap.get(step.partId)
                if (!part) return null
                return step.repeat > 1 ? `${part.label} x${step.repeat}` : part.label
              })
              .filter(Boolean)
              .join('  →  ')}
          </p>
        </section>

        <footer className="mt-6 border-t border-[var(--paper-line)] pt-3 text-[10px] tracking-[0.14em] text-[var(--paper-ink)]/45 uppercase sm:mt-8">
          OneSheet
        </footer>
      </article>
    </div>
  )
}
