import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type TransitionEvent,
} from "react";
import { createInitialSheet, toStrudel, toStrudelChain, type SheetState } from "./sheet";
import { readSheetFromSearch } from "./shareQuery";
import { SimpleSheet } from "./SimpleSheet";
import {
  activeSheet,
  clearSlot,
  createDefaultStudio,
  filledOrder,
  readStudioFromSearch,
  setActiveSlot,
  sheetsForChain,
  STUDIO_SLOT_COUNT,
  syncStudioQuery,
  updateActiveSheet,
  type StudioState,
} from "./studioDoc";
import { getCycleTime } from "./engine";

type Face = "simple" | "studio";
/** fold → (swap) edge → open → idle — 하단 도크 Y축 회전문 */
type FlipPhase = "idle" | "fold" | "edge" | "open";

function loadSimpleSheet(): SheetState {
  try {
    const fromUrl = readSheetFromSearch(window.location.search);
    if (fromUrl) return fromUrl;
  } catch (err) {
    console.warn("share query load failed", err);
  }
  return createInitialSheet();
}

function loadStudio(): StudioState {
  try {
    const fromUrl = readStudioFromSearch(window.location.search);
    if (fromUrl) return fromUrl;
  } catch (err) {
    console.warn("studio query load failed", err);
  }
  return createDefaultStudio();
}

function pathToFace(path: string): Face {
  return path.startsWith("/studio") ? "studio" : "simple";
}

function faceToPath(face: Face): string {
  return face === "studio" ? "/studio" : "/";
}

function preferReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function usePathname(): string {
  const [path, setPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return path;
}

function pushPath(to: string) {
  const next = new URL(to, window.location.origin).pathname;
  if (next === window.location.pathname && window.location.search === "") {
    return;
  }
  history.pushState(history.state, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function ModeChip({
  href,
  label,
  current,
  onNavigate,
}: {
  href: string;
  label: string;
  current: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <a
      className="chip mode-chip"
      href={href}
      aria-label={`${current}, switch to ${label}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        onNavigate(href);
      }}
    >
      <span className="chip-v">{label}</span>
    </a>
  );
}

const LONG_PRESS_MS = 480;

function StudioSlotPad({
  index,
  filled,
  active,
  live,
  mark,
  onSelect,
  onClear,
}: {
  index: number;
  filled: boolean;
  active: boolean;
  live: boolean;
  mark: string;
  onSelect: () => void;
  onClear: () => void;
}) {
  const timerRef = useRef<number | null>(null);
  const clearedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    clearedRef.current = false;
    clearTimer();
    if (!filled) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      clearedRef.current = true;
      onClear();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    clearTimer();
  };

  const onClick = () => {
    if (clearedRef.current) {
      clearedRef.current = false;
      return;
    }
    onSelect();
  };

  return (
    <button
      type="button"
      role="listitem"
      className={[
        "studio-slot",
        filled ? "filled" : "empty",
        active ? "active" : "",
        live ? "sounding" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={
        filled
          ? `sheet ${index + 1}${active ? ", active" : ""}. Hold to clear`
          : `empty slot ${index + 1}`
      }
      aria-pressed={active}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="studio-slot-n">{index + 1}</span>
      <span className="studio-slot-mark">{mark}</span>
    </button>
  );
}

function StudioDock({
  studio,
  sounding,
  onNavigate,
  onToggleChain,
  onSelectSlot,
  onClearSlot,
}: {
  studio: StudioState;
  sounding: number | null;
  onNavigate: (href: string) => void;
  onToggleChain: () => void;
  onSelectSlot: (index: number) => void;
  onClearSlot: (index: number) => void;
}) {
  return (
    <div className="studio-rail" aria-label="studio slots">
      <div className="studio-rail-top">
        <ModeChip
          href="/"
          label="SIMPLE"
          current="STUDIO"
          onNavigate={onNavigate}
        />
        <button
          type="button"
          className={`chip studio-chain${studio.chain ? " on" : ""}`}
          aria-pressed={studio.chain}
          aria-label="chain"
          onClick={onToggleChain}
        >
          <span className="chip-v">CHAIN</span>
        </button>
      </div>
      <div className="studio-slots" role="list">
        {Array.from({ length: STUDIO_SLOT_COUNT }, (_, i) => (
          <StudioSlotPad
            key={i}
            index={i}
            filled={studio.slots[i] != null}
            active={studio.active === i}
            live={sounding === i}
            mark={studio.slots[i]?.key ?? "·"}
            onSelect={() => onSelectSlot(i)}
            onClear={() => onClearSlot(i)}
          />
        ))}
      </div>
    </div>
  );
}

function SimpleDock({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <div className="studio-rail page-rail" aria-label="page">
      <div className="studio-rail-top">
        <ModeChip
          href="/studio"
          label="STUDIO"
          current="SIMPLE"
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

/**
 * 차트는 고정. 하단 도크만 세로축(rotateY) 회전문 —
 * SIMPLE 면 ↔ STUDIO 슬롯 면.
 */
export default function App() {
  const path = usePathname();
  const [simpleSheet, setSimpleSheet] = useState<SheetState>(loadSimpleSheet);
  const [studio, setStudio] = useState<StudioState>(loadStudio);
  const [face, setFace] = useState<Face>(() => pathToFace(path));
  const [flipPhase, setFlipPhase] = useState<FlipPhase>("idle");
  const [flipDir, setFlipDir] = useState<1 | -1>(1);
  const [sounding, setSounding] = useState<number | null>(null);

  const pendingFaceRef = useRef<Face | null>(null);
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const flipping = flipPhase !== "idle";

  useEffect(() => {
    if (flipping) return;
    const next = pathToFace(path);
    setFace((prev) => (prev === next ? prev : next));
  }, [path, flipping]);

  useEffect(() => {
    if (face !== "studio") return;
    const id = window.setTimeout(() => syncStudioQuery(studio), 180);
    return () => window.clearTimeout(id);
  }, [studio, face]);

  const order = useMemo(() => filledOrder(studio.slots), [studio.slots]);

  const patternOf = useCallback((live: SheetState) => {
    const merged = updateActiveSheet(studioRef.current, live);
    if (merged.chain) {
      const chain = sheetsForChain(merged);
      if (chain.length > 1) return toStrudelChain(chain);
    }
    return toStrudel(live);
  }, []);

  useEffect(() => {
    if (face !== "studio" || !studio.chain || order.length < 2) {
      setSounding(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = getCycleTime();
      if (t != null && order.length > 0) {
        const idx =
          order[((Math.floor(t) % order.length) + order.length) % order.length]!;
        setSounding((prev) => (prev === idx ? prev : idx));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [face, studio.chain, order]);

  const commitFace = useCallback((next: Face) => {
    setFace(next);
    pushPath(faceToPath(next));
  }, []);

  const navigateWithFlip = useCallback(
    (href: string) => {
      const next = pathToFace(href);
      if (next === face && !flipping) {
        pushPath(faceToPath(next));
        return;
      }
      if (flipping) return;

      if (preferReducedMotion()) {
        commitFace(next);
        return;
      }

      pendingFaceRef.current = next;
      setFlipDir(next === "studio" ? 1 : -1);
      setFlipPhase("fold");
    },
    [face, flipping, commitFace],
  );

  const onFlipTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;

    if (flipPhase === "fold") {
      const next = pendingFaceRef.current;
      if (next) commitFace(next);
      pendingFaceRef.current = null;
      setFlipPhase("edge");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFlipPhase("open"));
      });
      return;
    }

    if (flipPhase === "open") {
      setFlipPhase("idle");
    }
  };

  const onChangeSimple = useCallback((next: SheetState) => {
    setSimpleSheet(next);
  }, []);

  const onChangeStudioSheet = useCallback((next: SheetState) => {
    setStudio((prev) => updateActiveSheet(prev, next));
  }, []);

  const turnClass = [
    "dock-turntable",
    flipDir < 0 ? "dir-back" : "dir-fwd",
    flipPhase === "idle" ? "is-idle" : "",
    flipPhase === "fold" ? "is-fold" : "",
    flipPhase === "edge" ? "is-edge" : "",
    flipPhase === "open" ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-shell">
      <div className="app-chart">
        {face === "studio" ? (
          <SimpleSheet
            sheet={activeSheet(studio)}
            onChange={onChangeStudioSheet}
            patternOf={patternOf}
            playbackKey={`${studio.active}:${studio.chain}:${order.join(",")}`}
            className="app-panel"
          />
        ) : (
          <SimpleSheet
            sheet={simpleSheet}
            onChange={onChangeSimple}
            syncUrl
            className="app-panel"
          />
        )}
      </div>

      <div className="app-dock">
        <div className="dock-turn-stage">
          <div
            className={turnClass}
            onTransitionEnd={onFlipTransitionEnd}
          >
            {face === "studio" ? (
              <StudioDock
                studio={studio}
                sounding={sounding}
                onNavigate={navigateWithFlip}
                onToggleChain={() =>
                  setStudio((prev) => ({ ...prev, chain: !prev.chain }))
                }
                onSelectSlot={(i) =>
                  setStudio((prev) => setActiveSlot(prev, i))
                }
                onClearSlot={(i) => setStudio((prev) => clearSlot(prev, i))}
              />
            ) : (
              <SimpleDock onNavigate={navigateWithFlip} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
