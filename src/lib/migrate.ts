import type { LegacySection, Part, Song, StoredSong } from '../types/song'
import { createFormStep, createPart, createSong } from './songFactory'

/** Normalize any stored song into the Part + Form model. */
export function normalizeSong(raw: StoredSong): Song {
  if (Array.isArray(raw.parts) && raw.parts.length > 0) {
    return {
      ...createSong(),
      id: raw.id,
      title: raw.title,
      artist: raw.artist,
      key: raw.key,
      bpm: raw.bpm,
      timeSignature: raw.timeSignature,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      parts: raw.parts,
      form: Array.isArray(raw.form) && raw.form.length > 0
        ? raw.form
        : [createFormStep(raw.parts[0].id)],
    }
  }

  const sections = (raw as { sections?: LegacySection[] }).sections
  if (Array.isArray(sections) && sections.length > 0) {
    const parts: Part[] = sections.map((section, index) =>
      createPart({
        id: section.id,
        label: guessPartLabel(section.name, index),
        bars: section.bars,
        chords: section.chords,
      }),
    )
    const form = sections.map((section) =>
      createFormStep(section.id, { repeat: section.repeat || 1 }),
    )
    return {
      ...createSong(),
      id: raw.id,
      title: raw.title,
      artist: raw.artist,
      key: raw.key,
      bpm: raw.bpm,
      timeSignature: raw.timeSignature,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      parts,
      form,
    }
  }

  return createSong({
    id: raw.id,
    title: raw.title,
    artist: raw.artist,
    key: raw.key,
    bpm: raw.bpm,
    timeSignature: raw.timeSignature,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  })
}

function guessPartLabel(name: string, index: number): string {
  const trimmed = name.trim()
  if (/^[A-Za-z]'*$/.test(trimmed)) {
    return trimmed[0].toUpperCase() + trimmed.slice(1)
  }
  return String.fromCharCode(65 + (index % 26))
}
