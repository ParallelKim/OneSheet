import type { Part, Song } from '../types/song'
import { FormBuilder } from './FormBuilder'
import { PartEditor } from './PartEditor'

interface SongEditorProps {
  song: Song
  activePartId: string | null
  status: string
  onBack: () => void
  onPlayMode: () => void
  onDelete: () => void
  onUpdateMeta: (
    patch: Partial<Pick<Song, 'title' | 'artist' | 'key' | 'bpm' | 'timeSignature'>>,
  ) => void
  onSelectPart: (partId: string) => void
  onAddPart: () => void
  onAddVariation: (partId: string) => void
  onRemovePart: (partId: string) => void
  onUpdatePart: (partId: string, patch: Partial<Pick<Part, 'label' | 'bars'>>) => void
  onSetChord: (partId: string, barIndex: number, value: string) => void
  onAppendFormStep: (partId: string) => void
  onRemoveFormStep: (stepId: string) => void
  onMoveFormStep: (stepId: string, direction: -1 | 1) => void
  onUpdateFormStep: (stepId: string, repeat: number) => void
}

export function SongEditor({
  song,
  activePartId,
  status,
  onBack,
  onPlayMode,
  onDelete,
  onUpdateMeta,
  onSelectPart,
  onAddPart,
  onAddVariation,
  onRemovePart,
  onUpdatePart,
  onSetChord,
  onAppendFormStep,
  onRemoveFormStep,
  onMoveFormStep,
  onUpdateFormStep,
}: SongEditorProps) {
  const activePart =
    song.parts.find((part) => part.id === activePartId) ?? song.parts[0]

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

      <header className="mb-6">
        <input
          value={song.title}
          onChange={(e) => onUpdateMeta({ title: e.target.value })}
          className="brand-mark w-full bg-transparent text-3xl font-bold outline-none placeholder:text-[var(--muted)] sm:text-4xl"
          placeholder="곡 제목"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <MetaField
            label="Key"
            value={song.key}
            placeholder="Am"
            onChange={(value) => onUpdateMeta({ key: value })}
            mono
          />
          <MetaField
            label="BPM"
            value={song.bpm?.toString() ?? ''}
            placeholder="120"
            onChange={(value) =>
              onUpdateMeta({ bpm: value === '' ? null : Number(value) || null })
            }
          />
          <MetaField
            label="Artist"
            value={song.artist}
            placeholder="optional"
            onChange={(value) => onUpdateMeta({ artist: value })}
          />
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-sm font-semibold tracking-wide">Parts</h2>
        {song.parts.map((part) => {
          const selected = part.id === activePart.id
          return (
            <button
              key={part.id}
              type="button"
              onClick={() => onSelectPart(part.id)}
              className={`chord-font min-h-10 min-w-10 rounded-md border px-3 py-2 text-sm font-bold transition ${
                selected
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[#1a1408]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent-dim)] hover:text-[var(--text)]'
              }`}
            >
              {part.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onAddPart}
          className="rounded-md border border-dashed border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--accent-dim)] hover:text-[var(--text)]"
        >
          + Part
        </button>
      </div>

      {activePart && (
        <div className="mb-6">
          <PartEditor
            part={activePart}
            canRemove={song.parts.length > 1}
            onUpdate={(patch) => onUpdatePart(activePart.id, patch)}
            onSetChord={(barIndex, value) => onSetChord(activePart.id, barIndex, value)}
            onAddBar={() => onUpdatePart(activePart.id, { bars: activePart.bars + 1 })}
            onRemoveBar={() =>
              onUpdatePart(activePart.id, { bars: Math.max(1, activePart.bars - 1) })
            }
            onMakeVariation={() => onAddVariation(activePart.id)}
            onRemove={() => onRemovePart(activePart.id)}
          />
        </div>
      )}

      <FormBuilder
        parts={song.parts}
        form={song.form}
        onAppend={onAppendFormStep}
        onRemove={onRemoveFormStep}
        onMove={onMoveFormStep}
        onUpdateRepeat={onUpdateFormStep}
      />
    </div>
  )
}

function MetaField({
  label,
  value,
  placeholder,
  onChange,
  mono,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  mono?: boolean
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-2)]/50 px-2.5 py-1.5">
      <span className="text-[10px] tracking-wide text-[var(--muted)] uppercase">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-24 bg-transparent text-sm outline-none ${mono ? 'chord-font' : ''}`}
      />
    </label>
  )
}
