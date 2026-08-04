import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyC-3ZG2sES5tdmTCDuuuzJILZ-DZ68wNlM',
  authDomain: 'onesheet-app.firebaseapp.com',
  projectId: 'onesheet-app',
  storageBucket: 'onesheet-app.firebasestorage.app',
  messagingSenderId: '300193309223',
  appId: '1:300193309223:web:5301407732ce4fc8e72402',
  measurementId: 'G-E3FSTQSNRP',
}

export const app = initializeApp(firebaseConfig)

let analytics: Analytics | null = null
let analyticsReady: Promise<Analytics | null> | null = null

/** Analytics needs a browser + cookie support; guard headless/CI. */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (analytics) return analytics
  if (!analyticsReady) {
    analyticsReady = (async () => {
      try {
        if (!(await isSupported())) return null
        analytics = getAnalytics(app)
        return analytics
      } catch {
        return null
      }
    })()
  }
  return analyticsReady
}

export async function track(
  eventName: string,
  params: Record<string, string | number | boolean> = {},
): Promise<void> {
  const instance = await initFirebaseAnalytics()
  if (!instance) return
  const { logEvent } = await import('firebase/analytics')
  logEvent(instance, eventName, params)
}
