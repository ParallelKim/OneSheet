import { useEffect, useRef, useState, type ReactNode } from 'react'
import { chunkBars } from '../lib/bars'
import type { Part } from '../types/song'

interface PartEditorProps {
  part: Part
  onUpdate: (patch: Partial<Pick<Part, 'label' | 'bars'>>) => void
  onSetChord: (barIndex: number, value: string) => void
  onAddBar: () => void
  onRemoveBar: () => void
  onMakeVariation: () => void
  onRemove: () => void
  canRemove: boolean
}

export function PartEditor({
  part,
  onUpdate,
  onSetChord,
  onAddBar,
  onRemoveBar,
  onMakeVariation,
  onRemove,
  canRemove,
}: PartEditorProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const rows = chunkBars(
    part.chords.map((chord, index) => ({ chord, index })),
  )

  return (
    <section className="paper overflow-hidden rounded-2xl border border-[var(--paper-line)] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-3 border-b border-[var(--paper-line)] px-4 py-3 sm:px-5">
        <input
          value={part.label}
          onChange={(e) => onUpdate({ label: e.target.value || 'A' })}
          className="brand-mark w-16 rounded-md border border-[var(--paper-line)] bg-white/50 px-2 py-1 text-center text-2xl font-bold text-[var(--paper-ink)] outline-none focus:border-[var(--accent-dim)]"
          aria-label="파트 이름"
        />
        <div className="text-sm text-[var(--paper-ink)]/55">
          {part.bars} bars
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ToolbarButton onClick={onRemoveBar} disabled={part.bars <= 1}>
            − bar
          </ToolbarButton>
          <ToolbarButton onClick={onAddBar}>+ bar</ToolbarButton>
          <ToolbarButton onClick={onMakeVariation}>→ {part.label}'</ToolbarButton>
          <ToolbarButton onClick={onRemove} disabled={!canRemove} danger>
            삭제
          </ToolbarButton>
        </div>
      </div>

      <div className="flex items-start gap-2 px-3 py-5 sm:gap-3 sm:px-5">
        <div className="brand-mark w-7 shrink-0 pt-5 text-3xl font-bold text-[var(--paper-ink)]/20 select-none sm:w-10 sm:text-4xl">
          {part.label}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {rows.map((row) => (
            <div
              key={`row-${row[0].index}`}
              className="bar-row grid w-full grid-cols-4"
            >
              {row.map(({ chord, index }) => (
                <ChordCell
                  key={`${part.id}-${index}`}
                  index={index}
                  value={chord ?? ''}
                  inputRef={(el) => {
                    inputRefs.current[index] = el
                  }}
                  onChange={(value) => onSetChord(index, value)}
                  onNext={() => inputRefs.current[index + 1]?.focus()}
                  onPrev={() => inputRefs.current[index - 1]?.focus()}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="border-t border-[var(--paper-line)] px-4 py-2 text-xs text-[var(--paper-ink)]/45 sm:px-5">
        Tab / Enter로 다음 마디 · 한 줄 4마디
      </p>
    </section>
  )
}

function ChordCell({
  index,
  value,
  onChange,
  onNext,
  onPrev,
  inputRef,
}: {
  index: number
  value: string
  onChange: (value: string) => void
  onNext: () => void
  onPrev: () => void
  inputRef: (el: HTMLInputElement | null) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <div className="flex min-w-0 flex-col items-center border-r border-[var(--paper-line)] px-0.5 last:border-r-0">
      <span className="mb-1 text-[10px] tracking-wide text-[var(--paper-ink)]/35">
        {index + 1}
      </span>
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onChange(draft)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            onChange(draft)
            onNext()
          }
          if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart ?? 0) >= draft.length) {
            e.preventDefault()
            onChange(draft)
            onNext()
          }
          if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart ?? 0) === 0) {
            e.preventDefault()
            onChange(draft)
            onPrev()
          }
        }}
        className="chord-font w-full min-w-0 bg-transparent py-2 text-center text-lg font-semibold text-[var(--paper-ink)] outline-none sm:text-2xl"
        placeholder="—"
        spellCheck={false}
        aria-label={`${index + 1}마디 코드`}
        inputMode="text"
        autoCapitalize="characters"
      />
      <div className="mt-2 h-px w-full bg-[var(--paper-ink)]" />
      <div className="mt-0.5 h-2.5 w-px bg-[var(--paper-ink)]/55" />
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-30 ${
        danger
          ? 'border-[var(--paper-line)] text-[var(--paper-ink)]/60 hover:border-red-300 hover:text-red-600'
          : 'border-[var(--paper-line)] text-[var(--paper-ink)]/75 hover:border-[var(--accent-dim)] hover:text-[var(--paper-ink)]'
      }`}
    >
      {children}
    </button>
  )
}
