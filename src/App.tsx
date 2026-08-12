import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
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
  const longRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    longRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longRef.current = true;
      timerRef.current = null;
      onClear();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    const wasLong = longRef.current;
    clearTimer();
    if (!wasLong) onSelect();
  };

  const onPointerCancel = () => {
    clearTimer();
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
          ? `slot ${index + 1} ${mark}${active ? ", selected" : ""}`
          : `slot ${index + 1} empty`
      }
      aria-pressed={active}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
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
  onToggleChain,
  onSelectSlot,
  onClearSlot,
}: {
  studio: StudioState;
  sounding: number | null;
  onToggleChain: () => void;
  onSelectSlot: (index: number) => void;
  onClearSlot: (index: number) => void;
}) {
  return (
    <div className="studio-rail" aria-label="studio slots">
      <div className="studio-rail-top">
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

/**
 * `/` = 심플 한 장. `/studio` = 직접 진입할 때만 스튜디오 도크.
 * 심플↔스튜디오 인앱 플립/칩 전환 없음.
 */
export default function App() {
  const path = usePathname();
  const face = pathToFace(path);
  const [simpleSheet, setSimpleSheet] = useState<SheetState>(loadSimpleSheet);
  const [studio, setStudio] = useState<StudioState>(loadStudio);
  const [sounding, setSounding] = useState<number | null>(null);

  const studioRef = useRef(studio);
  studioRef.current = studio;

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

  const onChangeSimple = useCallback((next: SheetState) => {
    setSimpleSheet(next);
  }, []);

  const onChangeStudioSheet = useCallback((next: SheetState) => {
    setStudio((prev) => updateActiveSheet(prev, next));
  }, []);

  return (
    <div className={`app-shell${face === "simple" ? " is-simple" : " is-studio"}`}>
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

      {face === "studio" ? (
        <div className="app-dock" aria-label="studio">
          <StudioDock
            studio={studio}
            sounding={sounding}
            onToggleChain={() =>
              setStudio((prev) => ({ ...prev, chain: !prev.chain }))
            }
            onSelectSlot={(i) =>
              setStudio((prev) => setActiveSlot(prev, i))
            }
            onClearSlot={(i) => setStudio((prev) => clearSlot(prev, i))}
          />
        </div>
      ) : null}
    </div>
  );
}
