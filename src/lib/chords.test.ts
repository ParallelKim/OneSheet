import { describe, expect, it } from 'vitest'
import { normalizeChord, resizeChords } from './chords'

describe('normalizeChord', () => {
  it('capitalizes root notes', () => {
    expect(normalizeChord('bm')).toBe('Bm')
    expect(normalizeChord('f#m')).toBe('F#m')
  })

  it('keeps slash bass', () => {
    expect(normalizeChord('d/f#')).toBe('D/F#')
  })

  it('handles empty', () => {
    expect(normalizeChord('  ')).toBe('')
  })

  it('normalizes common qualities lightly', () => {
    expect(normalizeChord('cadd9')).toBe('Cadd9')
    expect(normalizeChord('gsus4')).toBe('Gsus4')
  })
})

describe('resizeChords', () => {
  it('truncates when smaller', () => {
    expect(resizeChords(['A', 'B', 'C', 'D'], 2)).toEqual(['A', 'B'])
  })

  it('pads with null when larger', () => {
    expect(resizeChords(['A'], 3)).toEqual(['A', null, null])
  })
})
