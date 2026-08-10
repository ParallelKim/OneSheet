import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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

function ModeChip({
  href,
  label,
  current,
}: {
  href: string;
  label: string;
  current: string;
}) {
  return (
    <a
      className="chip mode-chip"
      href={href}
      aria-label={`${current}, switch to ${label}`}
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

/** 심플 `/` — 한 장, ?s= */
export function SimplePage() {
  const [sheet, setSheet] = useState<SheetState>(loadSimpleSheet);
  const onChange = useCallback((next: SheetState) => setSheet(next), []);

  return (
    <SimpleSheet
      sheet={sheet}
      onChange={onChange}
      syncUrl
      dock={
        <div className="studio-rail page-rail" aria-label="page">
          <div className="studio-rail-top">
            <ModeChip href="/studio" label="STUDIO" current="SIMPLE" />
          </div>
        </div>
      }
    />
  );
}

/** 스튜디오 `/studio` — 8슬롯 + 체인, ?u= */
export function StudioPage() {
  const [studio, setStudio] = useState<StudioState>(loadStudio);
  const [sounding, setSounding] = useState<number | null>(null);
  const studioRef = useRef(studio);
  studioRef.current = studio;

  useEffect(() => {
    const id = window.setTimeout(() => syncStudioQuery(studio), 180);
    return () => window.clearTimeout(id);
  }, [studio]);

  const sheet = activeSheet(studio);
  const order = useMemo(() => filledOrder(studio.slots), [studio.slots]);

  /** 핫스왑 시 인자 sheet를 활성 슬롯에 반영한 뒤 패턴 생성 */
  const patternOf = useCallback((live: SheetState) => {
    const merged = updateActiveSheet(studioRef.current, live);
    if (merged.chain) {
      const chain = sheetsForChain(merged);
      if (chain.length > 1) return toStrudelChain(chain);
    }
    return toStrudel(live);
  }, []);

  // 체인 재생 중 울리는 슬롯 표시
  useEffect(() => {
    if (!studio.chain || order.length < 2) {
      setSounding(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = getCycleTime();
      if (t != null && order.length > 0) {
        const idx = order[((Math.floor(t) % order.length) + order.length) % order.length]!;
        setSounding((prev) => (prev === idx ? prev : idx));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [studio.chain, order]);

  const onChangeSheet = useCallback((next: SheetState) => {
    setStudio((prev) => updateActiveSheet(prev, next));
  }, []);

  const selectSlot = (index: number) => {
    setStudio((prev) => setActiveSlot(prev, index));
  };

  const onClearSlot = (index: number) => {
    setStudio((prev) => clearSlot(prev, index));
  };

  return (
    <SimpleSheet
      sheet={sheet}
      onChange={onChangeSheet}
      patternOf={patternOf}
      playbackKey={`${studio.active}:${studio.chain}:${order.join(",")}`}
      dock={
        <div className="studio-rail" aria-label="studio slots">
          <div className="studio-rail-top">
            <ModeChip href="/" label="SIMPLE" current="STUDIO" />
            <button
              type="button"
              className={`chip studio-chain${studio.chain ? " on" : ""}`}
              aria-pressed={studio.chain}
              aria-label="chain"
              onClick={() =>
                setStudio((prev) => ({ ...prev, chain: !prev.chain }))
              }
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
                onSelect={() => selectSlot(i)}
                onClear={() => onClearSlot(i)}
              />
            ))}
          </div>
        </div>
      }
    />
  );
}

/** pathname 기준 라우트 (리액트 라우터 없이) */
export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path.startsWith("/studio")) return <StudioPage />;
  return <SimplePage />;
}
