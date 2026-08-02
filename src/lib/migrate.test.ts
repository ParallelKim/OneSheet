import { describe, expect, it } from 'vitest'
import { normalizeSong } from './migrate'
import { nextPartLabel, variationLabel } from './songFactory'

describe('part labels', () => {
  it('assigns next free letter', () => {
    expect(nextPartLabel(['A'])).toBe('B')
    expect(nextPartLabel(['A', 'B', "A'"])).toBe('C')
  })

  it('builds variations', () => {
    expect(variationLabel('A')).toBe("A'")
    expect(variationLabel("A'")).toBe("A''")
  })
})

describe('normalizeSong', () => {
  it('migrates legacy sections into parts + form', () => {
    const song = normalizeSong({
      id: '1',
      title: 'Test',
      artist: '',
      key: 'G',
      bpm: 120,
      timeSignature: '4/4',
      createdAt: 1,
      updatedAt: 2,
      sections: [
        {
          id: 's1',
          name: 'Verse',
          bars: 4,
          repeat: 2,
          chords: ['G', 'D', 'Em', 'C'],
        },
        {
          id: 's2',
          name: 'Chorus',
          bars: 4,
          repeat: 1,
          chords: ['C', 'G', 'D', 'G'],
        },
      ],
    })

    expect(song.parts).toHaveLength(2)
    expect(song.parts[0].label).toBe('A')
    expect(song.parts[1].label).toBe('B')
    expect(song.form[0]).toMatchObject({ partId: 's1', repeat: 2 })
    expect(song.form[1]).toMatchObject({ partId: 's2', repeat: 1 })
  })
})
