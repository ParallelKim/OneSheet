import { getFirebaseAnalytics, isFirebaseConfigured } from './config'

type EventParams = Record<string, string | number | boolean | undefined>

export async function initAnalytics(): Promise<void> {
  if (!isFirebaseConfigured) return
  const analytics = await getFirebaseAnalytics()
  if (!analytics) return
  const { setUserProperties } = await import('firebase/analytics')
  setUserProperties(analytics, {
    app_surface: 'web',
    product: 'onesheet',
  })
}

export async function track(
  eventName: string,
  params: EventParams = {},
): Promise<void> {
  if (!isFirebaseConfigured) return
  const analytics = await getFirebaseAnalytics()
  if (!analytics) return

  const cleaned: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) cleaned[key] = value
  }
  const { logEvent } = await import('firebase/analytics')
  logEvent(analytics, eventName, cleaned)
}

export const AnalyticsEvents = {
  songCreate: () => track('song_create'),
  songOpen: (songId: string) => track('song_open', { song_id: songId }),
  songDelete: () => track('song_delete'),
  sectionAdd: (name: string) => track('section_add', { section_name: name }),
  viewPlay: () => track('view_play'),
  viewEdit: () => track('view_edit'),
  print: () => track('print_sheet'),
} as const
