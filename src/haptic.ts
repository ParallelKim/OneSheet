/**
 * Mobile haptic — progressive enhancement.
 * Android: navigator.vibrate. iOS: no official API → no-op.
 * Call only from user-gesture handlers (pointer/click/key).
 */

export type HapticKind = "tick" | "detent" | "latch" | "mark";

const PATTERNS: Record<HapticKind, number | number[]> = {
  /** pad press / select / brush */
  tick: 10,
  /** KEY · preset · knob step */
  detent: 14,
  /** mode / sound-mode bank latch */
  latch: 24,
  /** realm cross: ∅ · rest↔hit · metro · play/stop */
  mark: [12, 28, 12],
};

/** Min gap between pulses — knobs / rapid taps won't buzz-spam. */
const MIN_GAP_MS = 32;

let lastAt = 0;

function reducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    );
  } catch {
    return false;
  }
}

export function canHaptic(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    !reducedMotion()
  );
}

export function haptic(kind: HapticKind): void {
  if (!canHaptic()) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* no-op */
  }
}

/** Test helper — reset rate-limit clock. */
export function resetHapticClock(): void {
  lastAt = 0;
}
