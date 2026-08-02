import { describe, expect, it } from 'vitest'
import { chunkBars } from './bars'

describe('chunkBars', () => {
  it('groups by 4', () => {
    expect(chunkBars([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ])
  })

  it('keeps a short final row', () => {
    expect(chunkBars(['a', 'b', 'c', 'd', 'e'])).toEqual([
      ['a', 'b', 'c', 'd'],
      ['e'],
    ])
  })
})
