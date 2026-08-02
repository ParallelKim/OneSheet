export interface Part {
  id: string
  /** Display label: A, B, A' */
  label: string
  bars: number
  chords: (string | null)[]
}

/** One step in the assembled song form */
export interface FormStep {
  id: string
  partId: string
  repeat: number
}

export interface Song {
  id: string
  title: string
  artist: string
  key: string
  bpm: number | null
  timeSignature: string
  parts: Part[]
  form: FormStep[]
  createdAt: number
  updatedAt: number
}

export type ViewMode = 'edit' | 'play'

/** Legacy shape kept only for IndexedDB migration */
export interface LegacySection {
  id: string
  name: string
  bars: number
  repeat: number
  chords: (string | null)[]
  note?: string
}

export type StoredSong = Song | (Omit<Song, 'parts' | 'form'> & {
  sections?: LegacySection[]
  parts?: Part[]
  form?: FormStep[]
})
