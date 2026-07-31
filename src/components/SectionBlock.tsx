import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Section } from '../types/song'

interface SectionBlockProps {
  section: Section
  canRemove: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (
    patch: Partial<Pick<Section, 'name' | 'bars' | 'repeat' | 'note'>>,
  ) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onSetChord: (barIndex: number, value: string) => void
}

export function SectionBlock({
  section,
  canRemove,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onSetChord,
}: SectionBlockProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)]/80 p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[8rem] flex-1">
          <span className="mb-1 block text-[10px] tracking-wide text-[var(--muted)] uppercase">
            Section
          </span>
          <input
            value={section.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-2.5 py-1.5 font-semibold outline-none focus:border-[var(--accent-dim)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] tracking-wide text-[var(--muted)] uppercase">
            Bars
          </span>
          <input
            type="number"
            min={1}
            max={32}
            value={section.bars}
            onChange={(e) => onUpdate({ bars: Math.max(1, Number(e.target.value) || 1) })}
            className="w-16 rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-2 py-1.5 outline-none focus:border-[var(--accent-dim)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] tracking-wide text-[var(--muted)] uppercase">
            Repeat
          </span>
          <input
            type="number"
            min={1}
            max={16}
            value={section.repeat}
            onChange={(e) =>
              onUpdate({ repeat: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-16 rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-2 py-1.5 outline-none focus:border-[var(--accent-dim)]"
          />
        </label>
        <div className="ml-auto flex gap-1">
          <IconButton label="위로" disabled={!canMoveUp} onClick={onMoveUp}>
            ↑
          </IconButton>
          <IconButton label="아래로" disabled={!canMoveDown} onClick={onMoveDown}>
            ↓
          </IconButton>
          <IconButton label="복제" onClick={onDuplicate}>
            ⧉
          </IconButton>
          <IconButton label="삭제" disabled={!canRemove} onClick={onRemove} danger>
            ✕
          </IconButton>
        </div>
      </div>

      <div className="paper mb-3 overflow-x-auto rounded-lg border border-[var(--paper-line)] px-3 py-3">
        <div className="flex min-w-max items-end gap-0">
          {section.chords.map((chord, index) => (
            <ChordCell
              key={`${section.id}-${index}`}
              value={chord ?? ''}
              inputRef={(el) => {
                inputRefs.current[index] = el
              }}
              onChange={(value) => onSetChord(index, value)}
              onNext={() => inputRefs.current[index + 1]?.focus()}
              onPrev={() => inputRefs.current[index - 1]?.focus()}
            />
          ))}
          {section.repeat > 1 && (
            <span className="chord-font mb-2 ml-2 text-sm font-semibold text-[var(--paper-ink)]/70">
              x{section.repeat}
            </span>
          )}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] tracking-wide text-[var(--muted)] uppercase">
          Note
        </span>
        <input
          value={section.note}
          onChange={(e) => onUpdate({ note: e.target.value })}
          placeholder="Bass Synth, mute, drums open…"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent-dim)]"
        />
      </label>
    </article>
  )
}

function ChordCell({
  value,
  onChange,
  onNext,
  onPrev,
  inputRef,
}: {
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
    <div className="flex w-[4.5rem] flex-col items-center border-r border-[var(--paper-line)] last:border-r-0">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onChange(draft)}
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
        className="chord-font w-full bg-transparent px-1 py-1 text-center text-base font-semibold text-[var(--paper-ink)] outline-none"
        placeholder="—"
        spellCheck={false}
        aria-label="chord"
      />
      <div className="mt-1 h-px w-full bg-[var(--paper-ink)]/80" />
      <div className="mt-0.5 h-2 w-px bg-[var(--paper-ink)]/50" />
    </div>
  )
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border border-[var(--line)] px-2 py-1.5 text-sm disabled:opacity-30 ${
        danger
          ? 'hover:border-[var(--danger)] hover:text-[var(--danger)]'
          : 'hover:border-[var(--accent-dim)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  )
}
