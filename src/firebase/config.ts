/**
 * Firebase bootstrap.
 * Set VITE_FIREBASE_* in `.env` (see `.env.example`) before deploy/sync.
 * Local editing works fully offline via Dexie without Firebase credentials.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!auth) auth = getAuth(firebaseApp)
  return auth
}

export function getDb(): Firestore | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!firestore) firestore = getFirestore(firebaseApp)
  return firestore
}
