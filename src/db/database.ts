import Dexie, { type EntityTable } from 'dexie'
import type { Song } from '../types/song'

class OneSheetDB extends Dexie {
  songs!: EntityTable<Song, 'id'>

  constructor() {
    super('onesheet')
    this.version(1).stores({
      songs: 'id, title, updatedAt',
    })
  }
}

export const db = new OneSheetDB()

export async function listSongs(): Promise<Song[]> {
  return db.songs.orderBy('updatedAt').reverse().toArray()
}

export async function getSong(id: string): Promise<Song | undefined> {
  return db.songs.get(id)
}

export async function saveSong(song: Song): Promise<void> {
  await db.songs.put(song)
}

export async function deleteSong(id: string): Promise<void> {
  await db.songs.delete(id)
}
