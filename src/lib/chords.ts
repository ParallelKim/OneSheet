/** Normalize casual chord typing: bm → Bm, d/f# → D/F#, cadd9 → Cadd9 */
export function normalizeChord(input: string): string {
  const raw = input.trim()
  if (!raw) return ''

  const slashParts = raw.split('/')
  return slashParts.map(normalizeChordPart).join('/')
}

function normalizeChordPart(part: string): string {
  const trimmed = part.trim()
  if (!trimmed) return ''

  const match = trimmed.match(/^([a-gA-G])([#b]?)(.*)$/)
  if (!match) return trimmed

  const [, root, accidental, quality] = match
  const rootNorm = root.toUpperCase()
  const qualityNorm = normalizeQuality(quality)
  return `${rootNorm}${accidental}${qualityNorm}`
}

function normalizeQuality(quality: string): string {
  if (!quality) return ''

  // Keep common qualities readable; only lightly fix casing for maj/min/dim/aug/sus/add
  return quality
    .replace(/^maj/i, 'maj')
    .replace(/^min/i, 'min')
    .replace(/^m(?![aj])/i, 'm')
    .replace(/^dim/i, 'dim')
    .replace(/^aug/i, 'aug')
    .replace(/^sus/i, 'sus')
    .replace(/^add/i, 'add')
}

export function emptyChords(bars: number): (string | null)[] {
  return Array.from({ length: bars }, () => null)
}

export function resizeChords(
  chords: (string | null)[],
  bars: number,
): (string | null)[] {
  if (bars <= chords.length) return chords.slice(0, bars)
  return [...chords, ...emptyChords(bars - chords.length)]
}
