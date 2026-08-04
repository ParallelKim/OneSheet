import { useCallback, useState } from 'react'
import {
  createId,
  createPart,
  createSheet,
  type Part,
  type Sheet,
} from './sheet'
import { isPlaying, playSheet, stopSheet, updateSheet } from './engine'
import './App.css'

export default function App() {
  const [sheet, setSheet] = useState<Sheet>(createSheet)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('')

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
        return
      }
      await playSheet(sheet)
      setPlaying(true)
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

  function setChord(partId: string, index: number, chord: string) {
    const part = sheet.parts.find((p) => p.id === partId)
    if (!part) return
    const chords = [...part.chords] as Part['chords']
    chords[index] = chord
    updatePart(partId, { chords })
  }

  function addPart() {
    const part = createPart(String.fromCharCode(65 + sheet.parts.length))
    commit({
      ...sheet,
      parts: [...sheet.parts, part],
      form: [...sheet.form, { id: createId(), partId: part.id }],
    })
  }

  function removePart(partId: string) {
    if (sheet.parts.length <= 1) return
    commit({
      ...sheet,
      parts: sheet.parts.filter((p) => p.id !== partId),
      form: sheet.form.filter((step) => step.partId !== partId),
    })
  }

  function appendToForm(partId: string) {
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

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>OneSheet</h1>
          <p>장난감처럼 만지고, 바로 들어보는 한 장 차트</p>
        </div>
        <div className="transport">
          <label className="bpm">
            BPM
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
            className={playing ? 'stop' : 'play'}
            onClick={() => void togglePlay()}
          >
            {playing ? 'Stop' : 'Play'}
          </button>
        </div>
      </header>

      {status ? <p className="status">{status}</p> : null}

      <section className="zone parts-zone">
        <div className="zone-head">
          <h2>Parts</h2>
          <button type="button" onClick={addPart}>
            + Part
          </button>
        </div>
        <div className="parts">
          {sheet.parts.map((part) => (
            <article key={part.id} className="part">
              <div className="part-head">
                <input
                  className="part-name"
                  value={part.label}
                  onChange={(e) => updatePart(part.id, { label: e.target.value })}
                  aria-label="파트 이름"
                />
                <button type="button" onClick={() => appendToForm(part.id)}>
                  Form에 추가
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={sheet.parts.length <= 1}
                  onClick={() => removePart(part.id)}
                >
                  삭제
                </button>
              </div>
              <div className="bars">
                {part.chords.map((chord, i) => (
                  <label key={i} className="bar">
                    <span>{i + 1}</span>
                    <input
                      value={chord}
                      onChange={(e) => setChord(part.id, i, e.target.value)}
                      placeholder="Am"
                      spellCheck={false}
                    />
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="zone form-zone">
        <div className="zone-head">
          <h2>Form</h2>
          <button type="button" onClick={clearForm} disabled={sheet.form.length === 0}>
            Clear
          </button>
        </div>
        {sheet.form.length === 0 ? (
          <p className="empty">파트에서 「Form에 추가」로 순서를 만드세요.</p>
        ) : (
          <ol className="form">
            {sheet.form.map((step, index) => {
              const part = sheet.parts.find((p) => p.id === step.partId)
              return (
                <li key={step.id}>
                  <span className="form-index">{index + 1}</span>
                  <span className="form-name">{part?.label ?? '?'}</span>
                  <span className="form-chords">
                    {(part?.chords ?? []).filter(Boolean).join(' · ') || '—'}
                  </span>
                  <button type="button" onClick={() => removeFromForm(index)}>
                    ×
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
