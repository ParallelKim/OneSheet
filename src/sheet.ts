export type Part = {
  id: string
  label: string
  /** fixed 4 bars for prototype */
  chords: [string, string, string, string]
}

export type FormStep = {
  id: string
  partId: string
}

export type Sheet = {
  bpm: number
  parts: Part[]
  form: FormStep[]
}

export function createId(): string {
  return crypto.randomUUID()
}

export function createPart(label: string, chords?: Part['chords']): Part {
  return {
    id: createId(),
    label,
    chords: chords ?? ['', '', '', ''],
  }
}

export function createSheet(): Sheet {
  const a = createPart('A', ['Am', 'C', 'G', 'F'])
  const b = createPart('B', ['Em', 'Am', 'Dm', 'E7'])
  return {
    bpm: 96,
    parts: [a, b],
    form: [
      { id: createId(), partId: a.id },
      { id: createId(), partId: a.id },
      { id: createId(), partId: b.id },
    ],
  }
}

/** Expand form into a flat chord sequence (one event per bar). */
export function expandChords(sheet: Sheet): string[] {
  const byId = new Map(sheet.parts.map((p) => [p.id, p]))
  const out: string[] = []
  for (const step of sheet.form) {
    const part = byId.get(step.partId)
    if (!part) continue
    for (const chord of part.chords) {
      const c = chord.trim()
      out.push(c === '' ? '~' : c)
    }
  }
  return out
}

/** Compile sheet → Strudel code (function layer). */
export function toStrudel(sheet: Sheet): string {
  const seq = expandChords(sheet)
  if (seq.length === 0 || seq.every((c) => c === '~')) {
    return 'silence'
  }

  // one chord per bar
  const cps = sheet.bpm / 60 / 4
  const mini = seq.join(' ')

  return [
    `setcps(${cps})`,
    `chord("<${mini}>")`,
    `.voicing('legacy')`,
    `.s("sawtooth")`,
    `.gain(0.32)`,
    `.clip(0.85)`,
  ].join('\n')
}
