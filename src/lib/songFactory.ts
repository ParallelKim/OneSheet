import type { Section, Song } from '../types/song'
import { emptyChords } from './chords'
import { createId } from './id'

export function createSection(partial?: Partial<Section>): Section {
  const bars = partial?.bars ?? 4
  return {
    id: partial?.id ?? createId(),
    name: partial?.name ?? 'Section',
    bars,
    repeat: partial?.repeat ?? 1,
    chords: partial?.chords ?? emptyChords(bars),
    note: partial?.note ?? '',
  }
}

export function createSong(partial?: Partial<Song>): Song {
  const now = Date.now()
  return {
    id: partial?.id ?? createId(),
    title: partial?.title ?? 'Untitled',
    artist: partial?.artist ?? '',
    key: partial?.key ?? '',
    bpm: partial?.bpm ?? null,
    timeSignature: partial?.timeSignature ?? '4/4',
    sections: partial?.sections ?? [
      createSection({ name: 'Intro' }),
      createSection({ name: 'Verse' }),
      createSection({ name: 'Chorus' }),
    ],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  }
}

export const SECTION_PRESETS = [
  'Intro',
  'Verse',
  'Pre-Chorus',
  'Chorus',
  'Bridge',
  'Solo',
  'Interlude',
  'Outro',
] as const
