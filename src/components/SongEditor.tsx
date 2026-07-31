import { SECTION_PRESETS } from '../lib/songFactory'
import type { Section, Song } from '../types/song'
import { SectionBlock } from './SectionBlock'

interface SongEditorProps {
  song: Song
  status: string
  onBack: () => void
  onPlayMode: () => void
  onDelete: () => void
  onUpdateMeta: (
    patch: Partial<Pick<Song, 'title' | 'artist' | 'key' | 'bpm' | 'timeSignature'>>,
  ) => void
  onAddSection: (name?: string) => void
  onRemoveSection: (id: string) => void
  onMoveSection: (id: string, direction: -1 | 1) => void
  onDuplicateSection: (id: string) => void
  onUpdateSection: (
    id: string,
    patch: Partial<Pick<Section, 'name' | 'bars' | 'repeat' | 'note'>>,
  ) => void
  onSetChord: (sectionId: string, barIndex: number, value: string) => void
}

export function SongEditor({
  song,
  status,
  onBack,
  onPlayMode,
  onDelete,
  onUpdateMeta,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onDuplicateSection,
  onUpdateSection,
  onSetChord,
}: SongEditorProps) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
        >
          ← 목록
        </button>
        <button
          type="button"
          onClick={onPlayMode}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1408] hover:bg-[#f0c868]"
        >
          연주/인쇄
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`"${song.title}" 삭제?`)) onDelete()
          }}
          className="ml-auto rounded-md px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[#3a2430] hover:text-[var(--danger)]"
        >
          삭제
        </button>
        <span className="text-xs text-[var(--muted)]">
          {status === 'saving' ? '저장 중…' : status === 'error' ? '저장 오류' : '저장됨'}
        </span>
      </div>

      <section className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/60 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-[var(--muted)]">Title</span>
            <input
              value={song.title}
              onChange={(e) => onUpdateMeta({ title: e.target.value })}
              className="brand-mark w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2 text-2xl font-semibold outline-none focus:border-[var(--accent-dim)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">Artist</span>
            <input
              value={song.artist}
              onChange={(e) => onUpdateMeta({ artist: e.target.value })}
              className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2 outline-none focus:border-[var(--accent-dim)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">Key</span>
            <input
              value={song.key}
              onChange={(e) => onUpdateMeta({ key: e.target.value })}
              placeholder="Am"
              className="chord-font w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2 outline-none focus:border-[var(--accent-dim)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">BPM</span>
            <input
              type="number"
              min={1}
              max={300}
              value={song.bpm ?? ''}
              onChange={(e) =>
                onUpdateMeta({
                  bpm: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2 outline-none focus:border-[var(--accent-dim)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">Time</span>
            <input
              value={song.timeSignature}
              onChange={(e) => onUpdateMeta({ timeSignature: e.target.value })}
              className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2 outline-none focus:border-[var(--accent-dim)]"
            />
          </label>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-semibold">Sections</h2>
        {SECTION_PRESETS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onAddSection(name)}
            className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent-dim)] hover:text-[var(--text)]"
          >
            + {name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {song.sections.map((section, index) => (
          <SectionBlock
            key={section.id}
            section={section}
            canRemove={song.sections.length > 1}
            canMoveUp={index > 0}
            canMoveDown={index < song.sections.length - 1}
            onUpdate={(patch) => onUpdateSection(section.id, patch)}
            onRemove={() => onRemoveSection(section.id)}
            onMoveUp={() => onMoveSection(section.id, -1)}
            onMoveDown={() => onMoveSection(section.id, 1)}
            onDuplicate={() => onDuplicateSection(section.id)}
            onSetChord={(barIndex, value) => onSetChord(section.id, barIndex, value)}
          />
        ))}
      </div>
    </div>
  )
}
