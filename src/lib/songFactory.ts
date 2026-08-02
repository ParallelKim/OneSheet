import type { FormStep, Part, Song } from '../types/song'
import { emptyChords } from './chords'
import { createId } from './id'

export function createPart(partial?: Partial<Part>): Part {
  const bars = partial?.bars ?? 4
  return {
    id: partial?.id ?? createId(),
    label: partial?.label ?? 'A',
    bars,
    chords: partial?.chords ?? emptyChords(bars),
  }
}

export function createFormStep(
  partId: string,
  partial?: Partial<FormStep>,
): FormStep {
  return {
    id: partial?.id ?? createId(),
    partId,
    repeat: partial?.repeat ?? 1,
  }
}

export function nextPartLabel(existingLabels: string[]): string {
  const used = new Set(existingLabels.map((l) => l.toUpperCase()))
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!used.has(letter)) return letter
  }
  return `P${existingLabels.length + 1}`
}

/** A → A', A' → A'' */
export function variationLabel(label: string): string {
  return `${label}'`
}

export function createSong(partial?: Partial<Song>): Song {
  const now = Date.now()
  const partA = createPart({ label: 'A' })
  return {
    id: partial?.id ?? createId(),
    title: partial?.title ?? 'Untitled',
    artist: partial?.artist ?? '',
    key: partial?.key ?? '',
    bpm: partial?.bpm ?? null,
    timeSignature: partial?.timeSignature ?? '4/4',
    parts: partial?.parts ?? [partA],
    form: partial?.form ?? [createFormStep(partA.id)],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  }
}
