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
    activePartId,
    viewMode,
    hydrated,
    status,
    hydrate,
    openSong,
    createNewSong,
    closeSong,
    setViewMode,
    setActivePart,
    deleteCurrentSong,
    deleteSongById,
    updateMeta,
    addPart,
    addVariation,
    removePart,
    updatePart,
    setChord,
    appendFormStep,
    removeFormStep,
    moveFormStep,
    updateFormStep,
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
          activePartId={activePartId}
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
          onSelectPart={setActivePart}
          onAddPart={() => {
            void AnalyticsEvents.sectionAdd('part')
            addPart()
          }}
          onAddVariation={addVariation}
          onRemovePart={removePart}
          onUpdatePart={updatePart}
          onSetChord={setChord}
          onAppendFormStep={appendFormStep}
          onRemoveFormStep={removeFormStep}
          onMoveFormStep={moveFormStep}
          onUpdateFormStep={(stepId, repeat) => updateFormStep(stepId, { repeat })}
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
