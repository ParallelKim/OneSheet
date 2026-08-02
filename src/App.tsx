import { useEffect } from 'react'
import { PrintView } from './components/PrintView'
import { SongEditor } from './components/SongEditor'
import { SongList } from './components/SongList'
import { AnalyticsEvents, initAnalytics } from './firebase/analytics'
import { useSongStore } from './store/songStore'

export default function App() {
  const {
    songs,
    currentSong,
    viewMode,
    hydrated,
    status,
    hydrate,
    openSong,
    createNewSong,
    closeSong,
    setViewMode,
    deleteCurrentSong,
    deleteSongById,
    updateMeta,
    addSection,
    removeSection,
    moveSection,
    duplicateSection,
    updateSection,
    setChord,
  } = useSongStore()

  useEffect(() => {
    void hydrate()
    void initAnalytics()
  }, [hydrate])

  if (!hydrated) {
    return (
      <div className="app-shell grid min-h-screen place-items-center text-[var(--muted)]">
        불러오는 중…
      </div>
    )
  }

  if (currentSong && viewMode === 'play') {
    return (
      <div className="app-shell">
        <PrintView
          song={currentSong}
          onBack={() => {
            void AnalyticsEvents.viewEdit()
            setViewMode('edit')
          }}
        />
      </div>
    )
  }

  if (currentSong) {
    return (
      <div className="app-shell">
        <SongEditor
          song={currentSong}
          status={status}
          onBack={closeSong}
          onPlayMode={() => {
            void AnalyticsEvents.viewPlay()
            setViewMode('play')
          }}
          onDelete={() => {
            void AnalyticsEvents.songDelete()
            void deleteCurrentSong()
          }}
          onUpdateMeta={updateMeta}
          onAddSection={(name) => {
            void AnalyticsEvents.sectionAdd(name ?? 'Section')
            addSection(name)
          }}
          onRemoveSection={removeSection}
          onMoveSection={moveSection}
          onDuplicateSection={duplicateSection}
          onUpdateSection={updateSection}
          onSetChord={setChord}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <SongList
        songs={songs}
        onOpen={(id) => {
          void AnalyticsEvents.songOpen(id)
          void openSong(id)
        }}
        onCreate={() => {
          void AnalyticsEvents.songCreate()
          void createNewSong()
        }}
        onDelete={(id) => {
          void AnalyticsEvents.songDelete()
          void deleteSongById(id)
        }}
      />
    </div>
  )
}
