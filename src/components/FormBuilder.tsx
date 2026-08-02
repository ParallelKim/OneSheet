import type { FormStep, Part } from '../types/song'

interface FormBuilderProps {
  parts: Part[]
  form: FormStep[]
  onAppend: (partId: string) => void
  onRemove: (stepId: string) => void
  onMove: (stepId: string, direction: -1 | 1) => void
  onUpdateRepeat: (stepId: string, repeat: number) => void
}

export function FormBuilder({
  parts,
  form,
  onAppend,
  onRemove,
  onMove,
  onUpdateRepeat,
}: FormBuilderProps) {
  const partMap = new Map(parts.map((part) => [part.id, part]))

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/55 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text)]">
          Song Form
        </h2>
        <p className="text-xs text-[var(--muted)]">파트를 눌러 순서대로 붙입니다</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {parts.map((part) => (
          <button
            key={part.id}
            type="button"
            onClick={() => onAppend(part.id)}
            className="chord-font rounded-md border border-[var(--accent-dim)]/50 bg-[var(--bg-0)] px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#1a1408]"
          >
            + {part.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-wrap items-center gap-2">
        {form.map((step, index) => {
          const part = partMap.get(step.partId)
          if (!part) return null
          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-[var(--muted)]" aria-hidden>
                  →
                </span>
              )}
              <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg-0)] px-2 py-1.5">
                <span className="chord-font min-w-6 text-center text-base font-bold">
                  {part.label}
                </span>
                <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  x
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={step.repeat}
                    onChange={(e) =>
                      onUpdateRepeat(step.id, Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-10 rounded border border-[var(--line)] bg-[var(--bg-1)] px-1 py-0.5 text-center text-[var(--text)] outline-none"
                  />
                </label>
                <button
                  type="button"
                  aria-label="앞으로"
                  disabled={index === 0}
                  onClick={() => onMove(step.id, -1)}
                  className="px-1 text-[var(--muted)] disabled:opacity-30 hover:text-[var(--text)]"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="뒤로"
                  disabled={index === form.length - 1}
                  onClick={() => onMove(step.id, 1)}
                  className="px-1 text-[var(--muted)] disabled:opacity-30 hover:text-[var(--text)]"
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label="제거"
                  disabled={form.length <= 1}
                  onClick={() => onRemove(step.id)}
                  className="px-1 text-[var(--muted)] disabled:opacity-30 hover:text-[var(--danger)]"
                >
                  ×
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
