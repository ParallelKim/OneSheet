import { create } from 'zustand'
import {
  deleteSong as deleteSongFromDb,
  getSong,
  listSongs,
  saveSong,
} from '../db/database'
import { normalizeChord, resizeChords } from '../lib/chords'
import {
  createFormStep,
  createPart,
  createSong,
  nextPartLabel,
  variationLabel,
} from '../lib/songFactory'
import type { FormStep, Part, Song, ViewMode } from '../types/song'

interface SongState {
  songs: Song[]
  currentSong: Song | null
  activePartId: string | null
  viewMode: ViewMode
  hydrated: boolean
  status: 'idle' | 'loading' | 'saving' | 'error'
  error: string | null

  hydrate: () => Promise<void>
  openSong: (id: string) => Promise<void>
  createNewSong: () => Promise<void>
  closeSong: () => void
  setViewMode: (mode: ViewMode) => void
  setActivePart: (partId: string) => void
  deleteCurrentSong: () => Promise<void>
  deleteSongById: (id: string) => Promise<void>

  updateMeta: (
    patch: Partial<Pick<Song, 'title' | 'artist' | 'key' | 'bpm' | 'timeSignature'>>,
  ) => void

  addPart: () => void
  addVariation: (partId: string) => void
  removePart: (partId: string) => void
  updatePart: (
    partId: string,
    patch: Partial<Pick<Part, 'label' | 'bars'>>,
  ) => void
  setChord: (partId: string, barIndex: number, value: string) => void

  appendFormStep: (partId: string) => void
  removeFormStep: (stepId: string) => void
  moveFormStep: (stepId: string, direction: -1 | 1) => void
  updateFormStep: (stepId: string, patch: Partial<Pick<FormStep, 'repeat'>>) => void
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

function withSong(
  get: () => SongState,
  set: (
    partial:
      | Partial<SongState>
      | ((state: SongState) => Partial<SongState>),
  ) => void,
  updater: (song: Song) => Song,
  activePartId?: string | null,
): void {
  const current = get().currentSong
  if (!current) return
  const next = touchSong(updater(current))
  set({
    currentSong: next,
    ...(activePartId !== undefined ? { activePartId } : {}),
  })
  scheduleSave(get, set)
}

export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  currentSong: null,
  activePartId: null,
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
    set({
      currentSong: song,
      activePartId: song.parts[0]?.id ?? null,
      viewMode: 'edit',
    })
  },

  createNewSong: async () => {
    const song = createSong()
    await persist(song)
    const songs = await listSongs()
    set({
      songs,
      currentSong: song,
      activePartId: song.parts[0]?.id ?? null,
      viewMode: 'edit',
    })
  },

  closeSong: () => set({ currentSong: null, activePartId: null, viewMode: 'edit' }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setActivePart: (partId) => set({ activePartId: partId }),

  deleteCurrentSong: async () => {
    const song = get().currentSong
    if (!song) return
    await deleteSongFromDb(song.id)
    const songs = await listSongs()
    set({ songs, currentSong: null, activePartId: null, viewMode: 'edit' })
  },

  deleteSongById: async (id) => {
    await deleteSongFromDb(id)
    const songs = await listSongs()
    const current = get().currentSong
    set({
      songs,
      currentSong: current?.id === id ? null : current,
      activePartId: current?.id === id ? null : get().activePartId,
    })
  },

  updateMeta: (patch) => {
    withSong(get, set, (song) => ({ ...song, ...patch }))
  },

  addPart: () => {
    const current = get().currentSong
    if (!current) return
    const label = nextPartLabel(current.parts.map((p) => p.label))
    const part = createPart({ label })
    withSong(
      get,
      set,
      (song) => ({ ...song, parts: [...song.parts, part] }),
      part.id,
    )
  },

  addVariation: (partId) => {
    const current = get().currentSong
    if (!current) return
    const source = current.parts.find((p) => p.id === partId)
    if (!source) return
    const part = createPart({
      label: variationLabel(source.label),
      bars: source.bars,
      chords: [...source.chords],
    })
    const index = current.parts.findIndex((p) => p.id === partId)
    withSong(
      get,
      set,
      (song) => {
        const parts = [...song.parts]
        parts.splice(index + 1, 0, part)
        return { ...song, parts }
      },
      part.id,
    )
  },

  removePart: (partId) => {
    const current = get().currentSong
    if (!current || current.parts.length <= 1) return
    const parts = current.parts.filter((p) => p.id !== partId)
    const form = current.form.filter((step) => step.partId !== partId)
    const nextActive =
      get().activePartId === partId ? (parts[0]?.id ?? null) : get().activePartId
    withSong(
      get,
      set,
      (song) => ({
        ...song,
        parts,
        form: form.length ? form : [createFormStep(parts[0].id)],
      }),
      nextActive,
    )
  },

  updatePart: (partId, patch) => {
    withSong(get, set, (song) => ({
      ...song,
      parts: song.parts.map((part) => {
        if (part.id !== partId) return part
        const bars = patch.bars ?? part.bars
        return {
          ...part,
          ...patch,
          bars,
          chords:
            patch.bars !== undefined
              ? resizeChords(part.chords, bars)
              : part.chords,
        }
      }),
    }))
  },

  setChord: (partId, barIndex, value) => {
    const normalized = normalizeChord(value)
    withSong(get, set, (song) => ({
      ...song,
      parts: song.parts.map((part) => {
        if (part.id !== partId) return part
        const chords = [...part.chords]
        chords[barIndex] = normalized || null
        return { ...part, chords }
      }),
    }))
  },

  appendFormStep: (partId) => {
    withSong(get, set, (song) => ({
      ...song,
      form: [...song.form, createFormStep(partId)],
    }))
  },

  removeFormStep: (stepId) => {
    withSong(get, set, (song) => {
      if (song.form.length <= 1) return song
      return { ...song, form: song.form.filter((step) => step.id !== stepId) }
    })
  },

  moveFormStep: (stepId, direction) => {
    withSong(get, set, (song) => {
      const index = song.form.findIndex((step) => step.id === stepId)
      if (index < 0) return song
      const target = index + direction
      if (target < 0 || target >= song.form.length) return song
      const form = [...song.form]
      const [item] = form.splice(index, 1)
      form.splice(target, 0, item)
      return { ...song, form }
    })
  },

  updateFormStep: (stepId, patch) => {
    withSong(get, set, (song) => ({
      ...song,
      form: song.form.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
    }))
  },
}))
