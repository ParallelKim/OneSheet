import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
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

const PART_COLORS = ['#ff5a1f', '#3ddc97', '#4cc9f0', '#f4d35e', '#b388ff', '#ff8fab']

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
  const [selectedBar, setSelectedBar] = useState(0)
  const [writeMode, setWriteMode] = useState(false)
  const chordInputRef = useRef<HTMLInputElement>(null)

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

  function selectBar(index: number) {
    setSelectedBar(index)
    // focus hidden/parameter input for typing (LCD itself is display-only)
    requestAnimationFrame(() => chordInputRef.current?.focus())
  }

  function addPart() {
    const part = createPart(String.fromCharCode(65 + sheet.parts.length))
    commit({ ...sheet, parts: [...sheet.parts, part] })
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

  function nudgeBpm(delta: number) {
    commit({
      ...sheet,
      bpm: Math.max(40, Math.min(240, sheet.bpm + delta)),
    })
  }

  if (!activePart) return null

  const activeColor = colorById.get(activePart.id) ?? PART_COLORS[0]!
  const formPreview = sheet.form
    .map((step) => sheet.parts.find((p) => p.id === step.partId)?.label ?? '?')
    .join('')

  return (
    <div className={`device${playing ? ' is-playing' : ''}`}>
      <div className="po" style={{ '--accent': activeColor } as CSSProperties}>
        <div className="hang" aria-hidden />

        {/* PART — topmost lens */}
        <section className="part-row" aria-label="파트">
          <span className="silk">part</span>
          {sheet.parts.map((part, i) => (
            <button
              key={part.id}
              type="button"
              className={`part-dot${part.id === activePart.id ? ' on' : ''}`}
              style={{ '--dot': partColor(i) } as CSSProperties}
              onClick={() => setActivePartId(part.id)}
              aria-pressed={part.id === activePart.id}
            >
              {part.label}
            </button>
          ))}
          <button type="button" className="part-dot add" onClick={addPart} aria-label="파트 추가">
            +
          </button>
        </section>

        {status ? <p className="status">{status}</p> : null}

        {/* DISPLAY — read-only LCD */}
        <section className="lcd" aria-label="디스플레이">
          <div className="lcd-top">
            <span className="lcd-brand">onesheet</span>
            <span>{playing ? 'play' : 'stop'}</span>
            <span>{writeMode ? 'rec' : '——'}</span>
          </div>
          <div className="lcd-main">
            <div className="lcd-left">
              <p className="lcd-part">{activePart.label}</p>
              <p className="lcd-bpm">{sheet.bpm}<small>bpm</small></p>
            </div>
            <div className="lcd-glyph" aria-hidden>
              <span className="glyph-box" />
              <span className="glyph-box" />
              <span className="glyph-line" />
            </div>
          </div>
          <div className="lcd-chords">
            {activePart.chords.map((chord, i) => (
              <div
                key={i}
                className={`lcd-chord${selectedBar === i ? ' sel' : ''}`}
              >
                <span className="lcd-n">{i + 1}</span>
                <span className="lcd-c">{chord || '—'}</span>
              </div>
            ))}
          </div>
          <div className="lcd-form">
            <span>form</span>
            <span className="lcd-form-seq">{formPreview || '········'}</span>
          </div>
        </section>

        {/* parameter entry (not on LCD) */}
        <div className="param-row">
          <label className="param">
            <span className="silk">bar {selectedBar + 1}</span>
            <input
              ref={chordInputRef}
              value={activePart.chords[selectedBar] ?? ''}
              onChange={(e) => setChord(selectedBar, e.target.value)}
              spellCheck={false}
              placeholder="chord"
              aria-label={`${selectedBar + 1}마디 코드`}
            />
          </label>
          <div className="knobs" aria-label="노브">
            <button type="button" className="knob" onClick={() => nudgeBpm(-2)} aria-label="템포 감소">
              <span className="knob-cap a" />
              <span className="silk">A</span>
            </button>
            <button type="button" className="knob" onClick={() => nudgeBpm(2)} aria-label="템포 증가">
              <span className="knob-cap b" />
              <span className="silk">B</span>
            </button>
          </div>
        </div>

        {/* CONTROLS — PO matrix */}
        <section className="board" aria-label="컨트롤">
          <div className="func-row">
            <button
              type="button"
              className="key"
              onClick={() => {
                const idx = sheet.parts.findIndex((p) => p.id === activePart.id)
                const next = sheet.parts[(idx + 1) % sheet.parts.length]
                if (next) setActivePartId(next.id)
              }}
            >
              <span className="led" />
              <span className="key-label">sound</span>
            </button>
            <button type="button" className="key" onClick={stampToForm}>
              <span className="led" />
              <span className="key-label">pattern</span>
            </button>
            <button
              type="button"
              className="key"
              onClick={() => {
                const steps = [80, 96, 120, 140]
                const i = steps.findIndex((v) => v >= sheet.bpm)
                const next = steps[(i + 1) % steps.length] ?? 120
                commit({ ...sheet, bpm: next })
              }}
            >
              <span className="led" />
              <span className="key-label">bpm</span>
            </button>
            <button
              type="button"
              className="key"
              disabled={sheet.parts.length <= 1}
              onClick={removeActivePart}
            >
              <span className="led" />
              <span className="key-label">fx</span>
            </button>
          </div>

          <div className="matrix">
            <div className="pads" role="group" aria-label="16 패드">
              {Array.from({ length: 16 }, (_, i) => {
                const n = i + 1
                const isBar = n <= 4
                const formStep = sheet.form[n - 1]
                const lit =
                  (isBar && selectedBar === i) ||
                  (!!formStep && n <= sheet.form.length)
                return (
                  <button
                    key={n}
                    type="button"
                    className={`pad${lit ? ' lit' : ''}${isBar ? ' bar' : ''}`}
                    onClick={() => {
                      if (n <= 4) {
                        selectBar(i)
                        return
                      }
                      if (n <= 8) {
                        // 5-8: stamp / clear helpers
                        if (n === 5) stampToForm()
                        if (n === 6) clearForm()
                        if (n === 7 && sheet.form.length) removeFromForm(sheet.form.length - 1)
                        return
                      }
                    }}
                  >
                    <span className={`pad-led${lit ? ' on' : ''}`} />
                    <span className="pad-n">{n}</span>
                  </button>
                )
              })}
            </div>

            <div className="side">
              <button
                type="button"
                className={`side-key play${playing ? ' on' : ''}`}
                onClick={() => void togglePlay()}
                aria-pressed={playing}
              >
                <span className={`led${playing ? ' on' : ''}`} />
                <span className="key-label">play</span>
              </button>
              <button
                type="button"
                className={`side-key write${writeMode ? ' on' : ''}`}
                onClick={() => {
                  setWriteMode((v) => !v)
                  stampToForm()
                }}
              >
                <span className={`led red${writeMode ? ' on' : ''}`} />
                <span className="key-label">write</span>
              </button>
              <button type="button" className="side-key" onClick={clearForm} disabled={sheet.form.length === 0}>
                <span className="led" />
                <span className="key-label">clear</span>
              </button>
            </div>
          </div>

          <p className="legend">
            1–4 bar · 5 write form · 6 clear · 7 undo · write stamps part
          </p>
        </section>
      </div>
    </div>
  )
}
