export interface Section {
  id: string
  name: string
  bars: number
  repeat: number
  chords: (string | null)[]
  note: string
}

export interface Song {
  id: string
  title: string
  artist: string
  key: string
  bpm: number | null
  timeSignature: string
  sections: Section[]
  createdAt: number
  updatedAt: number
}

export type ViewMode = 'edit' | 'play'
