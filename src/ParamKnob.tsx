import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { haptic } from './haptic'

type ParamKnobProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Display string inside the dial */
  format?: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
  /**
   * Full rotations spanning min→max.
   * `1` (default): limited ~270° sweep.
   * `>1`: continuous multi-turn dial (e.g. BPM).
   */
  turns?: number
  /**
   * Vertical px per value unit. Defaults: limited sweep ≈ full range / 110px;
   * multi-turn ≈ 2.5px/unit for finer control.
   */
  dragPxPerUnit?: number
  /** Detent pulse when snapped value changes (default true). */
  hapticDetent?: boolean
}

const SWEEP_DEG = 270
const START_DEG = -135
/** px of vertical travel ≈ full min→max (single-sweep knobs) */
const DRAG_PX = 110
const MULTI_DRAG_PX_PER_UNIT = 2.5

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function snap(n: number, step: number) {
  if (step <= 0) return n
  return Math.round(n / step) * step
}

/** Vertical drag maps to value; dial rotation follows (TE / mobile pattern). */
export function ParamKnob({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(Math.round(v)),
  onChange,
  disabled = false,
  turns = 1,
  dragPxPerUnit,
  hapticDetent = true,
}: ParamKnobProps) {
  const dragRef = useRef<{
    pointerId: number
    startY: number
    startValue: number
    lastHaptic: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  const multi = turns > 1
  const range = max - min
  const t = range === 0 ? 0 : (value - min) / range
  const rotate = multi
    ? t * turns * 360
    : START_DEG + t * SWEEP_DEG

  const pxPerUnit =
    dragPxPerUnit ??
    (multi
      ? MULTI_DRAG_PX_PER_UNIT
      : range === 0
        ? DRAG_PX
        : DRAG_PX / range)

  function emitValue(next: number, from: number) {
    const clamped = clamp(next, min, max)
    if (clamped !== from && hapticDetent) haptic('detent')
    onChange(clamped)
  }

  function commitFromDeltaY(startValue: number, deltaY: number, lastHaptic: number) {
    const next = clamp(snap(startValue - deltaY / pxPerUnit, step), min, max)
    if (next !== lastHaptic && hapticDetent) {
      haptic('detent')
      if (dragRef.current) dragRef.current.lastHaptic = next
    }
    onChange(next)
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startValue: value,
      lastHaptic: value,
    }
    setDragging(true)
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    commitFromDeltaY(drag.startValue, e.clientY - drag.startY, drag.lastHaptic)
  }

  function endDrag(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    let next = value
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = value + step
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = value - step
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    else return
    e.preventDefault()
    emitValue(snap(next, step), value)
  }

  return (
    <button
      type="button"
      className={`chip knob-chip${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      aria-label={label}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(4))}
      aria-valuetext={format(value)}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <span className="param-knob">
        <span className="param-knob-k">{label}</span>
        <span className="param-knob-dial" aria-hidden>
          <span
            className="param-knob-rotator"
            style={{ transform: `rotate(${rotate}deg)` }}
          >
            <span className="param-knob-tick" />
          </span>
          <span className="param-knob-v">{format(value)}</span>
        </span>
      </span>
    </button>
  )
}
