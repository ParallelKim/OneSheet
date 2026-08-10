import { afterEach, describe, expect, it, vi } from "vitest";
import { canHaptic, haptic, resetHapticClock } from "./haptic";

describe("haptic", () => {
  afterEach(() => {
    resetHapticClock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("no-ops when vibrate is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(canHaptic()).toBe(false);
    expect(() => haptic("tick")).not.toThrow();
  });

  it("calls vibrate with tick pattern after cancel", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    resetHapticClock();
    haptic("tick");
    expect(vibrate).toHaveBeenCalledWith(0);
    expect(vibrate).toHaveBeenCalledWith(32);
  });

  it("uses mark pattern for realm cross", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    resetHapticClock();
    haptic("mark");
    expect(vibrate).toHaveBeenLastCalledWith([40, 32, 55]);
  });

  it("skips when prefers-reduced-motion", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });
    resetHapticClock();
    expect(canHaptic()).toBe(false);
    haptic("latch");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("rate-limits same kind but allows latch after tick", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    resetHapticClock();
    haptic("tick");
    haptic("tick");
    haptic("latch");
    const patterns = vibrate.mock.calls.map((c) => (c as unknown as [number | number[]])[0]);
    expect(patterns.filter((p) => p !== 0)).toEqual([32, [48, 36, 64]]);
  });
});
