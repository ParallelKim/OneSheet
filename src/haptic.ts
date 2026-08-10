/**
 * Mobile haptic — progressive enhancement.
 * Android: navigator.vibrate. iOS: no official API → no-op.
 * Call only from user-gesture handlers (pointer/click/key).
 *
 * Durations are intentionally ≥ ~30ms — shorter pulses are often
 * imperceptible on phone vibration motors.
 */

export type HapticKind = "tick" | "detent" | "latch" | "mark";

const PATTERNS: Record<HapticKind, number | number[]> = {
  /** pad press / select / brush */
  tick: 32,
  /** KEY · preset · knob step */
  detent: 45,
  /** mode / sound-mode bank latch — double knock */
  latch: [48, 36, 64],
  /** realm cross: ∅ · rest↔hit · metro · play/stop */
  mark: [40, 32, 55],
};

/** Per-kind gaps — latch/mark must not be blocked by recent ticks. */
const MIN_GAP_MS: Record<HapticKind, number> = {
  tick: 28,
  detent: 36,
  latch: 90,
  mark: 70,
};

const lastAt: Record<HapticKind, number> = {
  tick: 0,
  detent: 0,
  latch: 0,
  mark: 0,
};

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
  if (now - lastAt[kind] < MIN_GAP_MS[kind]) return;
  lastAt[kind] = now;
  try {
    // Cancel any in-flight buzz so the new pattern starts cleanly
    navigator.vibrate(0);
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* no-op */
  }
}

/** Test helper — reset rate-limit clocks. */
export function resetHapticClock(): void {
  lastAt.tick = 0;
  lastAt.detent = 0;
  lastAt.latch = 0;
  lastAt.mark = 0;
}
