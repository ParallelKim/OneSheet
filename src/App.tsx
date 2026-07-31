import { useEffect } from 'react'
import { PrintView } from './components/PrintView'
import { SongEditor } from './components/SongEditor'
import { SongList } from './components/SongList'
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
        <PrintView song={currentSong} onBack={() => setViewMode('edit')} />
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
          onPlayMode={() => setViewMode('play')}
          onDelete={() => void deleteCurrentSong()}
          onUpdateMeta={updateMeta}
          onAddSection={addSection}
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
        onOpen={(id) => void openSong(id)}
        onCreate={() => void createNewSong()}
        onDelete={(id) => void deleteSongById(id)}
      />
    </div>
  )
}
