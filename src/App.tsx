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

const PART_COLORS = ['#2ec4ff', '#ffd60a', '#ff4d6d', '#7bf1a8', '#c77dff', '#ff9f1c']

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

  function stampToForm(partId: string) {
    commit({
      ...sheet,
      form: [...sheet.form, { id: createId(), partId }],
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
      <div className="shell">
        <header className="mast">
          <div className="brand-block">
            <p className="brand">OneSheet</p>
            <p className="tag">한 장 · 만지면 들린다</p>
          </div>
          <label className="bpm-dial">
            <span>BPM</span>
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
            className={`transport ${playing ? 'on' : 'off'}`}
            onClick={() => void togglePlay()}
            aria-pressed={playing}
          >
            {playing ? 'STOP' : 'PLAY'}
          </button>
        </header>

        {status ? <p className="status">{status}</p> : null}

        <section className="lens" aria-label="파트">
          <div className="lens-row">
            {sheet.parts.map((part, i) => {
              const color = partColor(i)
              const selected = part.id === activePart.id
              return (
                <div key={part.id} className={`chip-wrap${selected ? ' selected' : ''}`}>
                  <button
                    type="button"
                    className={`chip${selected ? ' selected' : ''}`}
                    style={{ '--chip': color } as CSSProperties}
                    onClick={() => {
                      if (selected) stampToForm(part.id)
                      else setActivePartId(part.id)
                    }}
                    aria-pressed={selected}
                    title={selected ? '다시 눌러 FORM에 찍기' : '파트 선택'}
                  >
                    {part.label}
                  </button>
                  {selected && sheet.parts.length > 1 ? (
                    <button
                      type="button"
                      className="chip-x"
                      onClick={removeActivePart}
                      aria-label="파트 제거"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              )
            })}
            <button type="button" className="chip add" onClick={addPart} aria-label="파트 추가">
              +
            </button>
          </div>
          <p className="lens-hint">선택 중 같은 키를 다시 누르면 FORM에 찍힙니다</p>
        </section>

        <section
          className="pads"
          style={{ '--active': activeColor } as CSSProperties}
          aria-label="네 마디"
        >
          {activePart.chords.map((chord, i) => (
            <label
              key={i}
              className={`pad${focusBar === i ? ' focus' : ''}`}
            >
              <span className="pad-idx">{i + 1}</span>
              <input
                value={chord}
                onFocus={() => setFocusBar(i)}
                onBlur={() => setFocusBar(null)}
                onChange={(e) => setChord(i, e.target.value)}
                placeholder="—"
                spellCheck={false}
                aria-label={`${i + 1}마디 코드`}
              />
            </label>
          ))}
        </section>

        <section className="tape" aria-label="폼">
          <div className="tape-head">
            <span>FORM</span>
            <button
              type="button"
              className="ghost"
              disabled={sheet.form.length === 0}
              onClick={clearForm}
            >
              CLEAR
            </button>
          </div>
          {sheet.form.length === 0 ? (
            <p className="tape-empty">색 키를 두 번 눌러 순서를 만드세요</p>
          ) : (
            <ol className="tape-row">
              {sheet.form.map((step, index) => {
                const part = sheet.parts.find((p) => p.id === step.partId)
                const color = colorById.get(step.partId) ?? '#999'
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      className="brick"
                      style={{ '--chip': color } as CSSProperties}
                      onClick={() => removeFromForm(index)}
                      title="탭해서 제거"
                    >
                      <span className="brick-n">{index + 1}</span>
                      <span className="brick-l">{part?.label ?? '?'}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
