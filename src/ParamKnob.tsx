import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

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
}

const SWEEP_DEG = 270
const START_DEG = -135
/** px of vertical travel ≈ full min→max */
const DRAG_PX = 110

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function snap(n: number, step: number) {
  if (step <= 0) return n
  return Math.round(n / step) * step
}

/** Vertical drag maps to value; dial rotation is display-only (TE / mobile pattern). */
export function ParamKnob({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(Math.round(v)),
  onChange,
  disabled = false,
}: ParamKnobProps) {
  const dragRef = useRef<{
    pointerId: number
    startY: number
    startValue: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  const t = max === min ? 0 : (value - min) / (max - min)
  const rotate = START_DEG + t * SWEEP_DEG

  function commitFromDeltaY(startValue: number, deltaY: number) {
    const range = max - min
    const next = snap(startValue - (deltaY / DRAG_PX) * range, step)
    onChange(clamp(next, min, max))
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startValue: value,
    }
    setDragging(true)
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    commitFromDeltaY(drag.startValue, e.clientY - drag.startY)
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
    onChange(clamp(snap(next, step), min, max))
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
