import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import {
  createId,
  createPart,
  createSheet,
  type Part,
  type Sheet,
} from './sheet'
import { isPlaying, playSheet, stopSheet, updateSheet } from './engine'
import { track } from './firebase'
import './App.css'

const PART_COLORS = ['#ff8a3d', '#ffd24a', '#7ad7ff', '#9dffb0', '#ff7ab6', '#c9a0ff']

function partColor(index: number): string {
  return PART_COLORS[index % PART_COLORS.length]!
}

function boot(): { sheet: Sheet; activePartId: string } {
  const sheet = createSheet()
  return { sheet, activePartId: sheet.parts[0]!.id }
}

export default function App() {
  const [bootState] = useState(boot)
  const [sheet, setSheet] = useState<Sheet>(bootState.sheet)
  const [activePartId, setActivePartId] = useState(bootState.activePartId)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('')
  const [focusBar, setFocusBar] = useState<number | null>(null)

  const parts = sheet.parts
  const activePart =
    parts.find((p) => p.id === activePartId) ?? parts[0] ?? null

  const colorById = useMemo(() => {
    const map = new Map<string, string>()
    parts.forEach((p, i) => map.set(p.id, partColor(i)))
    return map
  }, [parts])

  const commit = useCallback((next: Sheet) => {
    setSheet(next)
    if (isPlaying()) {
      void updateSheet(next).catch((err: unknown) => {
        setStatus(err instanceof Error ? err.message : String(err))
      })
    }
  }, [])

  async function togglePlay() {
    setStatus('')
    try {
      if (playing) {
        stopSheet()
        setPlaying(false)
        void track('play_stop', { bpm: sheet.bpm })
        return
      }
      await playSheet(sheet)
      setPlaying(true)
      void track('play_start', {
        bpm: sheet.bpm,
        parts: sheet.parts.length,
        form_steps: sheet.form.length,
      })
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setPlaying(false)
    }
  }

  function updatePart(partId: string, patch: Partial<Part>) {
    commit({
      ...sheet,
      parts: sheet.parts.map((p) =>
        p.id === partId ? { ...p, ...patch } : p,
      ),
    })
  }

  function setChord(index: number, chord: string) {
    if (!activePart) return
    const chords = [...activePart.chords] as Part['chords']
    chords[index] = chord
    updatePart(activePart.id, { chords })
  }

  function addPart() {
    const part = createPart(String.fromCharCode(65 + sheet.parts.length))
    commit({
      ...sheet,
      parts: [...sheet.parts, part],
    })
    setActivePartId(part.id)
  }

  function stampToForm() {
    if (!activePart) return
    commit({
      ...sheet,
      form: [...sheet.form, { id: createId(), partId: activePart.id }],
    })
  }

  function removeFromForm(index: number) {
    commit({
      ...sheet,
      form: sheet.form.filter((_, i) => i !== index),
    })
  }

  function clearForm() {
    commit({ ...sheet, form: [] })
  }

  function removeActivePart() {
    if (!activePart || sheet.parts.length <= 1) return
    const nextParts = sheet.parts.filter((p) => p.id !== activePart.id)
    commit({
      ...sheet,
      parts: nextParts,
      form: sheet.form.filter((step) => step.partId !== activePart.id),
    })
    setActivePartId(nextParts[0]!.id)
  }

  if (!activePart) return null

  const activeColor = colorById.get(activePart.id) ?? PART_COLORS[0]!

  return (
    <div className={`device${playing ? ' is-playing' : ''}`}>
      <div className="po">
        <p className="po-brand">OneSheet</p>

        {/* 1. PART — always top */}
        <section className="part-rail" aria-label="파트">
          <span className="rail-label">PART</span>
          <div className="rail-keys">
            {sheet.parts.map((part, i) => {
              const color = partColor(i)
              const selected = part.id === activePart.id
              return (
                <button
                  key={part.id}
                  type="button"
                  className={`part-key${selected ? ' on' : ''}`}
                  style={{ '--part': color } as CSSProperties}
                  onClick={() => setActivePartId(part.id)}
                  aria-pressed={selected}
                >
                  {part.label}
                </button>
              )
            })}
            <button type="button" className="part-key add" onClick={addPart} aria-label="파트 추가">
              +
            </button>
          </div>
        </section>

        {status ? <p className="status">{status}</p> : null}

        {/* 2. DISPLAY — touchable LCD */}
        <section
          className="display"
          style={{ '--part': activeColor } as CSSProperties}
          aria-label="디스플레이"
        >
          <div className="lcd-meta">
            <span>{activePart.label}</span>
            <span>{sheet.bpm} BPM</span>
            <span>{playing ? '▶' : '■'}</span>
          </div>

          <div className="lcd-pads" aria-label="네 마디">
            {activePart.chords.map((chord, i) => (
              <label key={i} className={`lcd-cell${focusBar === i ? ' focus' : ''}`}>
                <span className="lcd-idx">{i + 1}</span>
                <input
                  value={chord}
                  onFocus={() => setFocusBar(i)}
                  onBlur={() => setFocusBar(null)}
                  onChange={(e) => setChord(i, e.target.value)}
                  placeholder="—"
                  spellCheck={false}
                  aria-label={`${i + 1}마디`}
                />
              </label>
            ))}
          </div>

          <div className="lcd-form" aria-label="폼 미리보기">
            <span className="lcd-form-label">FORM</span>
            {sheet.form.length === 0 ? (
              <span className="lcd-form-empty">—</span>
            ) : (
              <ol className="lcd-form-row">
                {sheet.form.map((step, index) => {
                  const part = sheet.parts.find((p) => p.id === step.partId)
                  const color = colorById.get(step.partId) ?? '#666'
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        className="lcd-brick"
                        style={{ '--part': color } as CSSProperties}
                        onClick={() => removeFromForm(index)}
                        title="탭해서 제거"
                      >
                        {part?.label ?? '?'}
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </section>

        {/* 3. CONTROL — PO button matrix */}
        <section className="controls" aria-label="컨트롤">
          <button type="button" className="ctrl write" onClick={stampToForm}>
            <span className="ctrl-k">WRITE</span>
            <span className="ctrl-v">FORM</span>
          </button>
          <button
            type="button"
            className="ctrl"
            disabled={sheet.form.length === 0}
            onClick={clearForm}
          >
            <span className="ctrl-k">CLEAR</span>
            <span className="ctrl-v">FORM</span>
          </button>
          <button
            type="button"
            className="ctrl"
            disabled={sheet.parts.length <= 1}
            onClick={removeActivePart}
          >
            <span className="ctrl-k">DEL</span>
            <span className="ctrl-v">PART</span>
          </button>
          <label className="ctrl bpm">
            <span className="ctrl-k">TEMPO</span>
            <input
              type="number"
              min={40}
              max={240}
              value={sheet.bpm}
              onChange={(e) =>
                commit({
                  ...sheet,
                  bpm: Math.max(40, Math.min(240, Number(e.target.value) || 120)),
                })
              }
            />
          </label>
          <button
            type="button"
            className={`ctrl play ${playing ? 'on' : ''}`}
            onClick={() => void togglePlay()}
            aria-pressed={playing}
          >
            <span className="ctrl-k">{playing ? 'STOP' : 'PLAY'}</span>
            <span className="ctrl-v">▶</span>
          </button>
        </section>
      </div>
    </div>
  )
}
