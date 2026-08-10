/**
 * Mobile haptic — progressive enhancement.
 * Android: navigator.vibrate. iOS: no official API → no-op.
 * Call only from user-gesture handlers (pointer/click/key).
 *
 * Pulses are ≥100ms — short values are often imperceptible on phone motors.
 * Do NOT call vibrate(0) before a pattern: on some Android builds that cancels
 * the subsequent pulse.
 */

export type HapticKind = "tick" | "detent" | "latch" | "mark";

const PATTERNS: Record<HapticKind, number | number[]> = {
  /** pad press / select / brush */
  tick: 100,
  /** KEY · preset · knob step */
  detent: 120,
  /** mode / sound-mode bank latch — double knock */
  latch: [120, 60, 160],
  /** realm cross: ∅ · rest↔hit · metro · play/stop */
  mark: [110, 50, 140],
};

/** Per-kind gaps — latch/mark must not be blocked by recent ticks. */
const MIN_GAP_MS: Record<HapticKind, number> = {
  tick: 80,
  detent: 90,
  latch: 200,
  mark: 160,
};

const lastAt: Record<HapticKind, number> = {
  tick: Number.NEGATIVE_INFINITY,
  detent: Number.NEGATIVE_INFINITY,
  latch: Number.NEGATIVE_INFINITY,
  mark: Number.NEGATIVE_INFINITY,
};

export type HapticDiag = {
  hasNavigator: boolean;
  hasVibrate: boolean;
  vibrateType: string;
  secureContext: boolean;
  reducedMotion: boolean;
  canHaptic: boolean;
  lastKind: HapticKind | null;
  lastOk: boolean | null;
  lastError: string | null;
  lastAtMs: number | null;
};

let lastKind: HapticKind | null = null;
let lastOk: boolean | null = null;
let lastError: string | null = null;
let lastFireAt: number | null = null;

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

function vibrateFn(): ((pattern: number | number[]) => boolean) | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
    webkitVibrate?: (pattern: number | number[]) => boolean;
    mozVibrate?: (pattern: number | number[]) => boolean;
  };
  const fn = nav.vibrate ?? nav.webkitVibrate ?? nav.mozVibrate;
  return typeof fn === "function" ? fn.bind(nav) : null;
}

export function canHaptic(): boolean {
  return !!vibrateFn() && !reducedMotion();
}

export function hapticDiag(): HapticDiag {
  const fn = vibrateFn();
  return {
    hasNavigator: typeof navigator !== "undefined",
    hasVibrate: !!fn,
    vibrateType: fn ? typeof fn : "missing",
    secureContext:
      typeof window !== "undefined" ? window.isSecureContext === true : false,
    reducedMotion: reducedMotion(),
    canHaptic: canHaptic(),
    lastKind,
    lastOk,
    lastError,
    lastAtMs: lastFireAt,
  };
}

/**
 * Fire haptic. Returns whether vibrate() reported success.
 * Still call from a user gesture.
 */
export function haptic(kind: HapticKind): boolean {
  const fn = vibrateFn();
  lastKind = kind;
  lastFireAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  if (!fn) {
    lastOk = false;
    lastError = "no vibrate API";
    return false;
  }
  if (reducedMotion()) {
    lastOk = false;
    lastError = "prefers-reduced-motion";
    return false;
  }

  const now = lastFireAt;
  if (now - lastAt[kind] < MIN_GAP_MS[kind]) {
    lastOk = false;
    lastError = "rate-limited";
    return false;
  }
  lastAt[kind] = now;

  try {
    // Intentionally no vibrate(0) cancel — it aborts the next pulse on some Androids.
    const ok = fn(PATTERNS[kind]) !== false;
    lastOk = ok;
    lastError = ok ? null : "vibrate returned false";
    return ok;
  } catch (err) {
    lastOk = false;
    lastError = err instanceof Error ? err.message : String(err);
    return false;
  }
}

/** Raw pulse for debugging (bypass kind patterns / rate limit of kinds). */
export function hapticRaw(ms: number): boolean {
  const fn = vibrateFn();
  lastKind = "tick";
  lastFireAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!fn) {
    lastOk = false;
    lastError = "no vibrate API";
    return false;
  }
  try {
    const ok = fn(Math.max(1, ms)) !== false;
    lastOk = ok;
    lastError = ok ? null : "vibrate returned false";
    return ok;
  } catch (err) {
    lastOk = false;
    lastError = err instanceof Error ? err.message : String(err);
    return false;
  }
}

/** Test helper — reset rate-limit clocks. */
export function resetHapticClock(): void {
  lastAt.tick = Number.NEGATIVE_INFINITY;
  lastAt.detent = Number.NEGATIVE_INFINITY;
  lastAt.latch = Number.NEGATIVE_INFINITY;
  lastAt.mark = Number.NEGATIVE_INFINITY;
  lastKind = null;
  lastOk = null;
  lastError = null;
  lastFireAt = null;
}
