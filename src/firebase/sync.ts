import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import type { Song } from '../types/song'
import { getDb, getFirebaseAuth, isFirebaseConfigured } from './config'

/**
 * Future remote sync helpers (Firestore).
 * Not wired into the UI yet — local Dexie remains source of truth for MVP.
 */
export async function pushSongToCloud(song: Song): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }
  const db = getDb()
  const auth = getFirebaseAuth()
  if (!db || !auth?.currentUser) {
    throw new Error('Firebase Auth user required for cloud sync')
  }
  const ref = doc(db, 'users', auth.currentUser.uid, 'songs', song.id)
  await setDoc(ref, song)
}

export async function pullSongsFromCloud(): Promise<Song[]> {
  if (!isFirebaseConfigured) return []
  const db = getDb()
  const auth = getFirebaseAuth()
  if (!db || !auth?.currentUser) return []

  const snap = await getDocs(
    collection(db, 'users', auth.currentUser.uid, 'songs'),
  )
  return snap.docs.map((d) => d.data() as Song)
}

export async function deleteSongFromCloud(songId: string): Promise<void> {
  if (!isFirebaseConfigured) return
  const db = getDb()
  const auth = getFirebaseAuth()
  if (!db || !auth?.currentUser) return
  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'songs', songId))
}
