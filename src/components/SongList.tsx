import type { Song } from '../types/song'

interface SongListProps {
  songs: Song[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

export function SongList({ songs, onOpen, onCreate, onDelete }: SongListProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-10 sm:px-8">
      <header className="mb-10">
        <p className="mb-3 text-sm tracking-[0.18em] text-[var(--accent)] uppercase">
          Guitar chart
        </p>
        <h1 className="brand-mark text-5xl font-bold text-[var(--text)] sm:text-6xl">
          OneSheet
        </h1>
        <p className="mt-4 max-w-md text-base text-[var(--muted)]">
          합주용 한 장 차트. 송폼, 코드, 반복, 메모만.
        </p>
      </header>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">내 곡</h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#1a1408] transition hover:bg-[#f0c868]"
        >
          새 곡
        </button>
      </div>

      {songs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-2)]/50 px-6 py-14 text-center">
          <p className="text-[var(--muted)]">아직 곡이 없습니다.</p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          >
            첫 차트 만들기
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {songs.map((song) => (
            <li
              key={song.id}
              className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/70 px-4 py-3 transition hover:border-[var(--accent-dim)]"
            >
              <button
                type="button"
                onClick={() => onOpen(song.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-base font-semibold">{song.title}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  {song.artist && <span>{song.artist}</span>}
                  {song.key && <span>Key {song.key}</span>}
                  {song.bpm != null && <span>{song.bpm} BPM</span>}
                  <span>{formatDate(song.updatedAt)}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`"${song.title}" 삭제?`)) onDelete(song.id)
                }}
                className="rounded-md px-2 py-1 text-xs text-[var(--muted)] opacity-70 transition hover:bg-[#3a2430] hover:text-[var(--danger)] group-hover:opacity-100"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
