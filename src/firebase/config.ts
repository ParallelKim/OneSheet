/**
 * Firebase bootstrap.
 * Set VITE_FIREBASE_* in `.env` (see `.env.example`) before deploy/sync.
 * Local editing works fully offline via Dexie without Firebase credentials.
 *
 * Analytics/Auth/Firestore are loaded on demand to keep the editor bundle small.
 */
import type { FirebaseApp } from 'firebase/app'
import type { Analytics } from 'firebase/analytics'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null
let analytics: Analytics | null = null
let analyticsInit: Promise<Analytics | null> | null = null

export async function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (!isFirebaseConfigured) return null
  if (app) return app
  const { initializeApp, getApps, getApp } = await import('firebase/app')
  app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return app
}

export async function getFirebaseAuth(): Promise<Auth | null> {
  const firebaseApp = await getFirebaseApp()
  if (!firebaseApp) return null
  if (auth) return auth
  const { getAuth } = await import('firebase/auth')
  auth = getAuth(firebaseApp)
  return auth
}

export async function getDb(): Promise<Firestore | null> {
  const firebaseApp = await getFirebaseApp()
  if (!firebaseApp) return null
  if (firestore) return firestore
  const { getFirestore } = await import('firebase/firestore')
  firestore = getFirestore(firebaseApp)
  return firestore
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (!firebaseConfig.measurementId) return null
  if (analytics) return analytics
  if (!analyticsInit) {
    analyticsInit = (async () => {
      try {
        const firebaseApp = await getFirebaseApp()
        if (!firebaseApp) return null
        const { getAnalytics, isSupported } = await import('firebase/analytics')
        if (!(await isSupported())) return null
        analytics = getAnalytics(firebaseApp)
        return analytics
      } catch {
        return null
      }
    })()
  }
  return analyticsInit
}
