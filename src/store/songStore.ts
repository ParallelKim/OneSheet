import { create } from 'zustand'
import {
  deleteSong as deleteSongFromDb,
  getSong,
  listSongs,
  saveSong,
} from '../db/database'
import { normalizeChord, resizeChords } from '../lib/chords'
import { createSection, createSong } from '../lib/songFactory'
import type { Section, Song, ViewMode } from '../types/song'

interface SongState {
  songs: Song[]
  currentSong: Song | null
  viewMode: ViewMode
  hydrated: boolean
  status: 'idle' | 'loading' | 'saving' | 'error'
  error: string | null

  hydrate: () => Promise<void>
  openSong: (id: string) => Promise<void>
  createNewSong: () => Promise<void>
  closeSong: () => void
  setViewMode: (mode: ViewMode) => void
  deleteCurrentSong: () => Promise<void>
  deleteSongById: (id: string) => Promise<void>

  updateMeta: (
    patch: Partial<Pick<Song, 'title' | 'artist' | 'key' | 'bpm' | 'timeSignature'>>,
  ) => void
  addSection: (name?: string) => void
  removeSection: (sectionId: string) => void
  moveSection: (sectionId: string, direction: -1 | 1) => void
  duplicateSection: (sectionId: string) => void
  updateSection: (
    sectionId: string,
    patch: Partial<Pick<Section, 'name' | 'bars' | 'repeat' | 'note'>>,
  ) => void
  setChord: (sectionId: string, barIndex: number, value: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function persist(song: Song): Promise<void> {
  await saveSong(song)
}

function scheduleSave(
  get: () => SongState,
  set: (partial: Partial<SongState>) => void,
): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const song = get().currentSong
    if (!song) return
    set({ status: 'saving' })
    try {
      await persist(song)
      const songs = await listSongs()
      set({ songs, status: 'idle', error: null })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : '저장 실패',
      })
    }
  }, 300)
}

function touchSong(song: Song): Song {
  return { ...song, updatedAt: Date.now() }
}

export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  currentSong: null,
  viewMode: 'edit',
  hydrated: false,
  status: 'idle',
  error: null,

  hydrate: async () => {
    set({ status: 'loading' })
    try {
      const songs = await listSongs()
      set({ songs, hydrated: true, status: 'idle', error: null })
    } catch (error) {
      set({
        hydrated: true,
        status: 'error',
        error: error instanceof Error ? error.message : '불러오기 실패',
      })
    }
  },

  openSong: async (id) => {
    const song = await getSong(id)
    if (!song) return
    set({ currentSong: song, viewMode: 'edit' })
  },

  createNewSong: async () => {
    const song = createSong()
    await persist(song)
    const songs = await listSongs()
    set({ songs, currentSong: song, viewMode: 'edit' })
  },

  closeSong: () => set({ currentSong: null, viewMode: 'edit' }),

  setViewMode: (mode) => set({ viewMode: mode }),

  deleteCurrentSong: async () => {
    const song = get().currentSong
    if (!song) return
    await deleteSongFromDb(song.id)
    const songs = await listSongs()
    set({ songs, currentSong: null, viewMode: 'edit' })
  },

  deleteSongById: async (id) => {
    await deleteSongFromDb(id)
    const songs = await listSongs()
    const current = get().currentSong
    set({
      songs,
      currentSong: current?.id === id ? null : current,
    })
  },

  updateMeta: (patch) => {
    const current = get().currentSong
    if (!current) return
    const next = touchSong({ ...current, ...patch })
    set({ currentSong: next })
    scheduleSave(get, set)
  },

  addSection: (name) => {
    const current = get().currentSong
    if (!current) return
    const section = createSection({ name: name ?? 'Section' })
    const next = touchSong({
      ...current,
      sections: [...current.sections, section],
    })
    set({ currentSong: next })
    scheduleSave(get, set)
  },

  removeSection: (sectionId) => {
    const current = get().currentSong
    if (!current || current.sections.length <= 1) return
    const next = touchSong({
      ...current,
      sections: current.sections.filter((s) => s.id !== sectionId),
    })
    set({ currentSong: next })
    scheduleSave(get, set)
  },

  moveSection: (sectionId, direction) => {
    const current = get().currentSong
    if (!current) return
    const index = current.sections.findIndex((s) => s.id === sectionId)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= current.sections.length) return
    const sections = [...current.sections]
    const [item] = sections.splice(index, 1)
    sections.splice(target, 0, item)
    const next = touchSong({ ...current, sections })
    set({ currentSong: next })
    scheduleSave(get, set)
  },

  duplicateSection: (sectionId) => {
    const current = get().currentSong
    if (!current) return
    const index = current.sections.findIndex((s) => s.id === sectionId)
    if (index < 0) return
    const source = current.sections[index]
    const copy = createSection({
      name: source.name,
      bars: source.bars,
      repeat: source.repeat,
      chords: [...source.chords],
      note: source.note,
    })
    const sections = [...current.sections]
    sections.splice(index + 1, 0, copy)
    const next = touchSong({ ...current, sections })
    set({ currentSong: next })
    scheduleSave(get, set)
  },

  updateSection: (sectionId, patch) => {
    const current = get().currentSong
    if (!current) return
    const sections = current.sections.map((section) => {
      if (section.id !== sectionId) return section
      const bars = patch.bars ?? section.bars
      return {
        ...section,
        ...patch,
        bars,
        chords:
          patch.bars !== undefined
            ? resizeChords(section.chords, bars)
            : section.chords,
      }
    })
    const next = touchSong({ ...current, sections })
    set({ currentSong: next })
    scheduleSave(get, set)
  },

  setChord: (sectionId, barIndex, value) => {
    const current = get().currentSong
    if (!current) return
    const normalized = normalizeChord(value)
    const sections = current.sections.map((section) => {
      if (section.id !== sectionId) return section
      const chords = [...section.chords]
      chords[barIndex] = normalized || null
      return { ...section, chords }
    })
    const next = touchSong({ ...current, sections })
    set({ currentSong: next })
    scheduleSave(get, set)
  },
}))
