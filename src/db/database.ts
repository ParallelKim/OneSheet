import Dexie, { type EntityTable } from 'dexie'
import { normalizeSong } from '../lib/migrate'
import type { Song, StoredSong } from '../types/song'

class OneSheetDB extends Dexie {
  songs!: EntityTable<StoredSong, 'id'>

  constructor() {
    super('onesheet')
    this.version(1).stores({
      songs: 'id, title, updatedAt',
    })
  }
}

export const db = new OneSheetDB()

export async function listSongs(): Promise<Song[]> {
  const rows = await db.songs.orderBy('updatedAt').reverse().toArray()
  return rows.map((row) => normalizeSong(row))
}

export async function getSong(id: string): Promise<Song | undefined> {
  const row = await db.songs.get(id)
  return row ? normalizeSong(row) : undefined
}

export async function saveSong(song: Song): Promise<void> {
  await db.songs.put(song)
}

export async function deleteSong(id: string): Promise<void> {
  await db.songs.delete(id)
}
