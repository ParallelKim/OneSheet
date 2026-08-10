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

  it("calls vibrate with tick pattern", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    resetHapticClock();
    haptic("tick");
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("uses mark pattern for realm cross", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    resetHapticClock();
    haptic("mark");
    expect(vibrate).toHaveBeenCalledWith([12, 28, 12]);
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

  it("rate-limits rapid calls", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    resetHapticClock();
    haptic("detent");
    haptic("detent");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
