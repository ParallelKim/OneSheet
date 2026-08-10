import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canHaptic,
  haptic,
  hapticDiag,
  hapticRaw,
  resetHapticClock,
} from "./haptic";

describe("haptic", () => {
  afterEach(() => {
    resetHapticClock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("no-ops when vibrate is missing", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      isSecureContext: true,
    });
    expect(canHaptic()).toBe(false);
    expect(haptic("tick")).toBe(false);
    expect(hapticDiag().lastError).toBe("no vibrate API");
  });

  it("calls vibrate with long tick pattern (no cancel pulse)", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      isSecureContext: true,
    });
    resetHapticClock();
    expect(haptic("tick")).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(100);
  });

  it("uses mark pattern for realm cross", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      isSecureContext: true,
    });
    resetHapticClock();
    haptic("mark");
    expect(vibrate).toHaveBeenCalledWith([110, 50, 140]);
  });

  it("skips when prefers-reduced-motion", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
      isSecureContext: true,
    });
    resetHapticClock();
    expect(canHaptic()).toBe(false);
    expect(haptic("latch")).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    expect(hapticDiag().lastError).toBe("prefers-reduced-motion");
  });

  it("rate-limits same kind but allows latch after tick", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      isSecureContext: true,
    });
    resetHapticClock();
    haptic("tick");
    haptic("tick");
    haptic("latch");
    expect(vibrate.mock.calls.map((c) => (c as unknown as [unknown])[0])).toEqual([
      100,
      [120, 60, 160],
    ]);
  });

  it("hapticRaw bypasses kind patterns", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      isSecureContext: true,
    });
    expect(hapticRaw(200)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(200);
  });
});
