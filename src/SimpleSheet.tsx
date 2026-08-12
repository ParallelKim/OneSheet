import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ARTICULATIONS,
  artLabel,
  barIndex,
  barRhythm,
  BEATS,
  BARS,
  BAR_STEPS,
  BPM_MAX,
  BPM_MIN,
  TONE_AXES,
  clearRhythmOverride,
  defaultTonesForDegree,
  DEGREE_META,
  nextSoundMode,
  paintDegreeSlot,
  paintRhythmStep,
  paintToneSlot,
  rhythmBarKind,
  shiftKey,
  SLOTS,
  slotLabel,
  slotRoman,
  soundModeById,
  SUBDIV,
  toneAxisFaces,
  toneAxisLabel,
  toneAxisOn,
  toneAxisPolarity,
  TOTAL_STEPS,
  toStrudel,
  type Articulation,
  type SheetState,
  type ToneAxisId,
} from "./sheet";
import { syncSheetQuery } from "./shareQuery";
import {
  ensureAudioRunning,
  evaluateStrudel,
  getAudioState,
  getCyclePhase,
  getLastStrudelCode,
  getPlaybackEpoch,
  hushStrudel,
  initStrudelEngine,
  isEngineReady,
  unlockAudioOutput,
  warmPianoFont,
} from "./engine";
import { KeyReel } from "./KeyReel";
import { ParamKnob } from "./ParamKnob";
import { haptic, hapticDiag, hapticRaw } from "./haptic";
import "./simple/AppPanel.css";
import "./simple/Lcd.css";
import "./simple/Transport.css";
import "./simple/RhythmSlot.css";
import "./simple/Pads.css";
import "./simple/Status.css";
import "./simple/HapticDebug.css";

type EngineState = "idle" | "loading" | "ready" | "playing" | "error";
/** 렌즈: 같은 4×4 패드의 의미를 바꾼다 */
type Mode = "chart" | "degree" | "rhythm";

export type SimpleSheetProps = {
  sheet: SheetState;
  onChange: (next: SheetState) => void;
  /** 심플 페이지에서만 ?s= 동기화 */
  syncUrl?: boolean;
  /** 재생/핫스왑 패턴 (기본 toStrudel). 스튜디오 체인용 */
  patternOf?: (sheet: SheetState) => string;
  /**
   * 슬롯/체인 전환 등 외부 재생 소스 변경 신호.
   * 값이 바뀌고 재생 중이면 패턴을 다시 밀어 넣는다.
   */
  playbackKey?: string | number;
  nav?: ReactNode;
  /** 패드 그리드 아래 도크 (스튜디오 슬롯·CHAIN) */
  dock?: ReactNode;
  className?: string;
};

/**
 * 재생 링 열 좌표: 셀 공격~대부분 구간은 칸 중심(정수)에 머물고,
 * 끝부분에서만 다음 칸으로 슬라이드 — 소리와 칸이 같이 느껴지도록.
 */
function playColHold(posInRow: number, hold = 0.7): number {
  const i = Math.floor(posInRow);
  const frac = posInRow - i;
  if (frac <= hold) return i;
  return i + (frac - hold) / (1 - hold);
}

/** 한 장 차트 엔진 — 심플/스튜디오가 같은 UI를 임베드한다. */
export function SimpleSheet({
  sheet,
  onChange,
  syncUrl = false,
  patternOf,
  playbackKey,
  nav,
  dock,
  className,
}: SimpleSheetProps) {
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("chart");
  const [brush, setBrush] = useState<Articulation>("D");
  const [engine, setEngine] = useState<EngineState>("idle");
  const [status, setStatus] = useState("");
  /** 재생 헤드: 4분 슬롯 0–15 (null = 정지) — 텍스트용 */
  const [playSlot, setPlaySlot] = useState<number | null>(null);
  /** 키 릴: dir/gen은 nudge 시에만 갱신 */
  const [keySpin, setKeySpin] = useState<{ dir: 1 | -1; gen: number }>({
    dir: 1,
    gen: 0,
  });
  /** 모드 전환 시 같은 키 위 잉크만 짧게 펄스 */
  const [bankFlash, setBankFlash] = useState(false);
  const bankFlashTimerRef = useRef<number | null>(null);
  const hapticDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("haptic");
  const [hapticLog, setHapticLog] = useState("");
  const sheetRef = useRef(sheet);
  const playingRef = useRef(false);
  const patternOfRef = useRef(patternOf);
  const staffRef = useRef<HTMLDivElement>(null);
  const padStageRef = useRef<HTMLDivElement>(null);
  const padBoardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  useEffect(() => {
    patternOfRef.current = patternOf;
  }, [patternOf]);

  useEffect(() => {
    return () => {
      if (bankFlashTimerRef.current != null) {
        window.clearTimeout(bankFlashTimerRef.current);
      }
    };
  }, []);

  const codeOf = useCallback((s: SheetState) => {
    const custom = patternOfRef.current;
    return custom ? custom(s) : toStrudel(s);
  }, []);

  // 단일 세션 저장은 ?s= 만
  useEffect(() => {
    if (!syncUrl) return;
    const id = window.setTimeout(() => syncSheetQuery(sheet), 160);
    return () => window.clearTimeout(id);
  }, [sheet, syncUrl]);

  // 엔진은 마운트 직후 백그라운드 기동 (Play를 기다리지 않음)
  useEffect(() => {
    void initStrudelEngine().catch((err) => console.warn("engine boot", err));
    return () => {
      hushStrudel();
      playingRef.current = false;
    };
  }, []);

  // 첫 포인터에서 오디오 unlock (iOS: 제스처 안에서 동기)
  useEffect(() => {
    const onFirstPointer = () => {
      unlockAudioOutput();
      void ensureAudioRunning().catch((err) =>
        console.warn("audio unlock", err),
      );
    };
    window.addEventListener("pointerdown", onFirstPointer, {
      once: true,
      passive: true,
    });
    return () => window.removeEventListener("pointerdown", onFirstPointer);
  }, []);

  /** 패드 실측 → --pad-cell-px / --pad-stride-px (항상 width===height 정원) */
  useEffect(() => {
    const board = padBoardRef.current;
    if (!board) return;

    const syncPadMetrics = () => {
      const pads = board.querySelectorAll<HTMLElement>(".pad-grid > .pad");
      const first = pads[0];
      if (!first) return;
      const a = first.getBoundingClientRect();
      if (a.width < 2) return;
      const cell = a.width;
      const next = pads[1]?.getBoundingClientRect();
      const below = pads[BEATS]?.getBoundingClientRect();
      const strideX = next ? next.left - a.left : cell + 8;
      const strideY = below ? below.top - a.top : strideX;
      // 한 프레임에 가로·세로가 어긋나면 스킵 (레이아웃 미완료)
      if (Math.abs(strideX - strideY) > 1) return;
      board.style.setProperty("--pad-cell-px", `${cell}px`);
      board.style.setProperty("--pad-stride-px", `${strideX}px`);
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncPadMetrics);
    });
    ro.observe(board);
    requestAnimationFrame(syncPadMetrics);
    return () => ro.disconnect();
  }, [mode]);

  // Strudel 사이클 → LCD/그리드 재생 커서 CSS 변수
  useEffect(() => {
    if (engine !== "playing") {
      setPlaySlot(null);
      staffRef.current?.style.setProperty("--play-phase", "-1");
      padStageRef.current?.style.setProperty("--play-on", "0");
      return;
    }
    let raf = 0;
    const tick = () => {
      const phase = getCyclePhase();
      if (phase !== null) {
        const slot = Math.min(SLOTS - 1, Math.floor(phase * SLOTS));
        const slotF = phase * SLOTS;
        const row = Math.floor(slotF / BEATS) % BARS;
        const col = playColHold(slotF % BEATS);
        const stepF = (phase * TOTAL_STEPS) % BAR_STEPS;
        const rhyRow = Math.floor(stepF / SUBDIV) % BEATS;
        const rhyCol = playColHold(stepF % SUBDIV);

        setPlaySlot((prev) => (prev === slot ? prev : slot));
        const staff = staffRef.current;
        if (staff) {
          staff.style.setProperty("--play-phase", phase.toFixed(5));
          staff.style.setProperty("--mark-bar", String(row));
        }
        const pad = padStageRef.current;
        if (pad) {
          pad.style.setProperty("--play-on", "1");
          pad.style.setProperty("--mark-bar", String(row));
          pad.style.setProperty("--play-col-f", col.toFixed(5));
          pad.style.setProperty("--play-row-f", String(row));
          pad.style.setProperty("--play-row-next", String((row + 1) % BARS));
          pad.style.setProperty("--play-row-prev", String((row - 1 + BARS) % BARS));
          pad.style.setProperty("--rhy-col-f", rhyCol.toFixed(5));
          pad.style.setProperty("--rhy-row-f", String(rhyRow));
          pad.style.setProperty("--rhy-row-next", String((rhyRow + 1) % BEATS));
          pad.style.setProperty("--rhy-row-prev", String((rhyRow - 1 + BEATS) % BEATS));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const pushPattern = useCallback(async (next: SheetState) => {
    if (!playingRef.current) return;
    try {
      const ok = await evaluateStrudel(codeOf(next));
      if (!ok && playingRef.current) {
        // 정지 레이스로 무효화된 평가
        playingRef.current = false;
        setEngine((e) => (e === "error" ? e : "ready"));
        setStatus("");
      }
    } catch (err) {
      console.error(err, getLastStrudelCode());
      setEngine("error");
      setStatus("pattern error");
    }
  }, [codeOf]);

  // 스튜디오 슬롯/체인 전환 시 재생 중이면 패턴 재평가
  const playbackKeyRef = useRef(playbackKey);
  useEffect(() => {
    if (playbackKeyRef.current === playbackKey) return;
    playbackKeyRef.current = playbackKey;
    if (!playingRef.current) return;
    void pushPattern(sheetRef.current);
  }, [playbackKey, pushPattern]);

  const update = useCallback(
    (recipe: (prev: SheetState) => SheetState) => {
      const next = recipe(sheetRef.current);
      onChange(next);
      void pushPattern(next);
    },
    [onChange, pushPattern],
  );

  const cycleSoundMode = useCallback(() => {
    const soundMode = nextSoundMode(sheetRef.current.soundMode);
    if (soundMode === "piano") {
      void warmPianoFont().catch(() => undefined);
    }
    haptic("latch");
    update((prev) => ({ ...prev, soundMode }));
  }, [update]);

  const nudgeKey = useCallback(
    (dir: 1 | -1) => {
      update((prev) => {
        const next = shiftKey(prev.key, dir);
        if (next === prev.key) return prev;
        haptic("detent");
        setKeySpin((s) => ({ dir, gen: s.gen + 1 }));
        return { ...prev, key: next };
      });
    },
    [update],
  );

  const onPlay = useCallback(() => {
    const gate = getPlaybackEpoch();
    // 제스처 콜스택에서 동기 unlock (async 전에)
    unlockAudioOutput();
    haptic("mark");

    if (!isEngineReady()) {
      setEngine("loading");
      setStatus("");
    }

    void (async () => {
      try {
        await ensureAudioRunning();
        if (getPlaybackEpoch() !== gate) {
          setEngine((e) => (e === "error" ? e : "ready"));
          return;
        }
        await initStrudelEngine();
        if (getPlaybackEpoch() !== gate) {
          setEngine((e) => (e === "error" ? e : "ready"));
          return;
        }
        const code = codeOf(sheetRef.current);
        // UI 위상을 0에 붙인 뒤 스케줄러 start — 첫 코드 잘림 완화
        playingRef.current = true;
        setEngine("playing");
        setStatus("");
        const ok = await evaluateStrudel(code, { syncStart: true });
        if (!ok || getPlaybackEpoch() !== gate) {
          playingRef.current = false;
          setEngine((e) => (e === "error" ? e : "ready"));
          setStatus("");
          return;
        }
        setStatus(
          getAudioState() === "running" ? "" : "audio locked — tap PLAY",
        );
      } catch (err) {
        console.error(err, getLastStrudelCode());
        playingRef.current = false;
        setEngine("error");
        setStatus("play error");
      }
    })();
  }, [codeOf]);

  const onStop = useCallback(() => {
    haptic("mark");
    hushStrudel();
    playingRef.current = false;
    setEngine((e) => (e === "error" ? e : "ready"));
    setStatus("");
  }, []);

  const paintDegree = (degree: number | null) => {
    const cur = sheetRef.current.degrees[selected] ?? null;
    if (degree === null) haptic("mark");
    else if (cur === degree) haptic("detent");
    else haptic("tick");
    update((prev) => paintDegreeSlot(prev, selected, degree));
  };

  const paintTone = (axisId: ToneAxisId) => {
    const axis = TONE_AXES.find((a) => a.id === axisId);
    const before = axis
      ? toneAxisPolarity(sheetRef.current.tones[selected], axis)
      : "off";
    const next = paintToneSlot(sheetRef.current, selected, axisId);
    const after = axis ? toneAxisPolarity(next.tones[selected], axis) : "off";
    haptic(before !== "off" && after === "off" ? "mark" : "detent");
    update((prev) => paintToneSlot(prev, selected, axisId));
  };

  const paintRhythm = (step: number) => {
    const bar = barIndex(selected);
    const current = barRhythm(sheetRef.current, bar)[step] ?? "rest";
    const nextArt = current === brush ? "rest" : brush;
    haptic(nextArt === "rest" || current === "rest" ? "mark" : "tick");
    update((prev) => paintRhythmStep(prev, bar, step, nextArt));
  };

  const resetRhythmLink = () => {
    const bar = barIndex(selected);
    haptic("mark");
    update((prev) => clearRhythmOverride(prev, bar));
  };

  const selectBar = (bar: number) => {
    haptic("tick");
    setSelected(bar * BEATS + (selected % BEATS));
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    // 햅틱은 pointerdown에서 (안드 제스처 결합). 여기는 시각만.
    setMode(next);
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    if (bankFlashTimerRef.current != null) {
      window.clearTimeout(bankFlashTimerRef.current);
    }
    setBankFlash(true);
    bankFlashTimerRef.current = window.setTimeout(() => {
      setBankFlash(false);
      bankFlashTimerRef.current = null;
    }, 180);
  };

  const playing = engine === "playing";
  const loading = engine === "loading";
  const currentDegree = sheet.degrees[selected] ?? null;
  const bar = barIndex(selected);
  const barRhythmRow = barRhythm(sheet, bar);
  const rhyKind = rhythmBarKind(sheet, bar);
  const playBar = playSlot !== null ? barIndex(playSlot) : null;
  /** 하이라이트할 마디: 재생 중이면 재생 마디, 아니면 선택 마디 */
  const markBar = playBar ?? bar;

  return (
    <div className={`app${className ? ` ${className}` : ""}`}>
      {nav ? <div className="app-nav">{nav}</div> : null}
      <section className="lcd" aria-label="lcd">
        <div className="lcd-meta">
          <div className="chip key-chip" role="group" aria-label="key">
            <span className="chip-k">KEY</span>
            <button
              type="button"
              className="key-step"
              onClick={() => nudgeKey(-1)}
              aria-label="key down flat"
            >
              ♭
            </button>
            <KeyReel value={sheet.key} dir={keySpin.dir} gen={keySpin.gen} />
            <button
              type="button"
              className="key-step"
              onClick={() => nudgeKey(1)}
              aria-label="key up sharp"
            >
              ♯
            </button>
          </div>
          <ParamKnob
            label="BPM"
            value={sheet.bpm}
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            turns={4}
            onChange={(bpm) => update((prev) => ({ ...prev, bpm }))}
          />
          <ParamKnob
            label="VOL"
            value={sheet.gain}
            min={0.05}
            max={1}
            step={0.01}
            format={(v) => String(Math.round(v * 100))}
            hapticBucket={(v) => Math.round(v * 20)}
            onChange={(gain) => update((prev) => ({ ...prev, gain }))}
          />
          <button
            type="button"
            className="chip"
            onClick={cycleSoundMode}
            aria-label="sound mode"
          >
            <span className="chip-pair">
              <span className="chip-k">MODE</span>
              <span className="chip-v">{soundModeById(sheet.soundMode).label}</span>
            </span>
          </button>
        </div>

        <div
          ref={staffRef}
          className={`staff ${playing ? "is-playing" : ""}`}
          aria-label="chart"
          style={{ "--mark-bar": markBar } as CSSProperties}
        >
          <div className="staff-back" aria-hidden>
            <div className="ind-measure" />
            <div className="ind-cursor" />
          </div>
          <div className="staff-front">
            {Array.from({ length: BARS }, (_, bi) => (
              <div
                key={bi}
                className={`measure rhy-${rhythmBarKind(sheet, bi)} ${mode === "rhythm" ? "rhy-show" : ""}`}
                role="group"
                aria-label={`bar ${bi + 1} ${rhythmBarKind(sheet, bi)}`}
                onClick={() => selectBar(bi)}
              >
                {Array.from({ length: BEATS }, (_, qi) => {
                  const i = bi * BEATS + qi;
                  const d = sheet.degrees[i] ?? null;
                  const on = selected === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`chord-cell ${on ? "on" : ""} ${d === null ? "empty" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        haptic("tick");
                        setSelected(i);
                      }}
                      aria-label={`bar ${bi + 1} beat ${qi + 1}`}
                    >
                      <span className="chord-name">{slotLabel(sheet.key, d, sheet.tones[i])}</span>
                      <span className="chord-deg">{d !== null ? slotRoman(d) : "·"}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="transport" aria-label="transport">
        <button
          type="button"
          className={`tr-btn play ${playing ? "on" : ""} ${loading ? "loading" : ""}`}
          onPointerDown={() => {
            // click보다 이른 제스처에서 unlock (iOS 필수)
            if (playing || loading) return;
            unlockAudioOutput();
          }}
          onClick={() => void (playing || loading ? onStop() : onPlay())}
          aria-label={loading ? "loading" : playing ? "stop" : "play"}
          aria-busy={loading}
        >
          <span className="tr-icon" aria-hidden>
            {loading ? (
              <span className="spin" />
            ) : (
              <span className="tr-transport-icon">
                <span className={`tr-glyph ${playing ? "is-off" : "is-on"}`}>
                  ▶
                </span>
                <span className={`tr-glyph ${playing ? "is-on" : "is-off"}`}>
                  ■
                </span>
              </span>
            )}
          </span>
          <span className="tr-label">
            {loading ? "LOAD" : playing ? "STOP" : "PLAY"}
          </span>
        </button>
        <button
          type="button"
          className={`tr-btn metro ${sheet.metro ? "on" : ""}`}
          onClick={() => {
            haptic("mark");
            update((prev) => ({ ...prev, metro: !prev.metro }));
          }}
          aria-pressed={sheet.metro}
          aria-label="metronome"
        >
          <span className="tr-icon" aria-hidden>
            <svg
              className="tr-metro"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 사다리꼴 본체 (플랫탑) */}
              <path d="M8 3.5h8l3.2 16.5H4.8L8 3.5Z" />
              {/* 중앙 눈금대 */}
              <path d="M12 5.2v12.2" />
              <path
                className="tr-metro-ticks"
                d="M10.2 7.2h3.6M10.2 9.4h3.6M10.2 11.6h3.6M10.2 13.8h3.6"
              />
              {/* 추봉 — 하단 피벗 고정, 위가 기울어짐 */}
              <path d="M12 17.4 16.6 5.8" />
              <rect
                className="tr-metro-bob"
                x="14.55"
                y="7.85"
                width="3.4"
                height="2.5"
                rx="0.35"
                transform="rotate(-20 16.25 9.1)"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </span>
          <span className="tr-label">CLICK</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "chart" ? "on" : ""}`}
          onPointerDown={() => {
            if (mode !== "chart") haptic("latch");
          }}
          onClick={() => switchMode("chart")}
          aria-label="chart"
          aria-pressed={mode === "chart"}
        >
          <span className="tr-icon">▦</span>
          <span className="tr-label">GRID</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "degree" ? "on" : ""}`}
          onPointerDown={() => {
            if (mode !== "degree") haptic("latch");
          }}
          onClick={() => switchMode("degree")}
          aria-label="degree"
          aria-pressed={mode === "degree"}
        >
          <span className="tr-icon">I</span>
          <span className="tr-label">DEG</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "rhythm" ? "on" : ""}`}
          onPointerDown={() => {
            if (mode !== "rhythm") haptic("latch");
          }}
          onClick={() => switchMode("rhythm")}
          aria-label="rhythm"
          aria-pressed={mode === "rhythm"}
        >
          <span className="tr-icon">♩♪</span>
          <span className="tr-label">RHY</span>
        </button>
      </nav>

      <div
        className={`rhy-slot ${mode === "rhythm" ? "is-open" : ""}`}
        aria-hidden={mode !== "rhythm"}
      >
        <div className="rhy-slot-inner">
          <div className="rhy-meta" aria-label="rhythm source">
            <span className={`rhy-tag rhy-tag-${rhyKind}`}>
              {rhyKind === "base" && "BASE · BAR 1"}
              {rhyKind === "link" && `LINK · ← BAR 1`}
              {rhyKind === "own" && `OWN · BAR ${bar + 1}`}
            </span>
            {rhyKind === "own" && (
              <button
                type="button"
                className="rhy-reset"
                onClick={resetRhythmLink}
                tabIndex={mode === "rhythm" ? undefined : -1}
              >
                USE BASE
              </button>
            )}
            {rhyKind === "link" && (
              <span className="rhy-hint">edit to fork</span>
            )}
          </div>
          <div className="brush-row" aria-label="articulation">
            {ARTICULATIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`brush ${brush === a.id ? "on" : ""}`}
                tabIndex={mode === "rhythm" ? undefined : -1}
                onClick={() => {
                  if (brush === a.id) return;
                  haptic("tick");
                  setBrush(a.id);
                }}
              >
                <span className="brush-mark">{a.label}</span>
                <span className="brush-hint">{a.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={padStageRef}
        className={`pad-stage ${playing ? "is-playing" : ""} mode-${mode} rhy-${rhyKind}${bankFlash ? " bank-flash" : ""}`}
        style={{ "--mark-bar": markBar } as CSSProperties}
      >
        <div className="pad-board" ref={padBoardRef}>
          <div className="pad-back" aria-hidden>
            <div
              className={`pad-ind pad-ind-bar ${mode === "chart" ? "is-on" : ""}`}
            />
          </div>
          {/* 재생 링: 오버레이만 점등 — 패드 슬롯과 분리 */}
          <div
            className={`pad-play ${mode === "chart" ? "is-on" : ""}`}
            aria-hidden
          >
            <div className="pad-play-orb pad-play-orb-chart pad-play-orb-prev" />
            <div className="pad-play-orb pad-play-orb-chart pad-play-orb-main" />
            <div className="pad-play-orb pad-play-orb-chart pad-play-orb-next" />
          </div>
          <div
            className={`pad-play pad-play-rhythm ${mode === "rhythm" && playBar === bar ? "is-on" : ""}`}
            aria-hidden
          >
            <div className="pad-play-orb pad-play-orb-rhythm pad-play-orb-prev" />
            <div className="pad-play-orb pad-play-orb-rhythm pad-play-orb-main" />
            <div className="pad-play-orb pad-play-orb-rhythm pad-play-orb-next" />
          </div>
          <section className="pad-grid" aria-label={modeLabel(mode)}>
            {Array.from({ length: SLOTS }, (_, i) => (
              <LaunchPad
                key={i}
                index={i}
                mode={mode}
                sheet={sheet}
                selected={selected}
                currentDegree={currentDegree}
                barRhythmRow={barRhythmRow}
                rhyKind={rhyKind}
                onSelect={() => {
                  haptic("tick");
                  setSelected(i);
                }}
                onPaintDegree={paintDegree}
                onPaintTone={paintTone}
                onPaintRhythm={paintRhythm}
              />
            ))}
          </section>
        </div>
      </div>

      {dock ? <div className="app-dock">{dock}</div> : null}

      {status ? <p className="status">{status}</p> : null}
      {hapticDebug ? (
        <div className="haptic-debug" role="status">
          <p className="haptic-debug-log">{hapticLog || "press a button below"}</p>
          <div className="haptic-debug-row">
            <button
              type="button"
              className="haptic-debug-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                const ok = hapticRaw(100);
                setHapticLog(
                  `BTN1 raw100 → ${ok ? "api-ok" : "api-fail"} · ${formatHapticDiag()}`,
                );
              }}
            >
              1·100ms
            </button>
            <button
              type="button"
              className="haptic-debug-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                const ok = haptic("latch");
                setHapticLog(
                  `BTN2 latch → ${ok ? "api-ok" : "api-fail"} · ${formatHapticDiag()}`,
                );
              }}
            >
              2·latch
            </button>
            <button
              type="button"
              className="haptic-debug-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                const ok = hapticRaw(500);
                setHapticLog(
                  `BTN3 raw500 → ${ok ? "api-ok" : "api-fail"} · ${formatHapticDiag()}`,
                );
              }}
            >
              3·500ms
            </button>
            <button
              type="button"
              className="haptic-debug-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                setHapticLog(`BTN4 diag · ${formatHapticDiag()}`);
              }}
            >
              4·diag
            </button>
          </div>
          <p className="haptic-debug-hint">
            auxiliary only — silent/DND may block with no warning. use device
            vibrate profile.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function formatHapticDiag(): string {
  const d = hapticDiag();
  return [
    `can=${d.canHaptic}`,
    `api=${d.hasVibrate}`,
    `secure=${d.secureContext}`,
    `rm=${d.reducedMotion}`,
    `err=${d.lastError ?? "-"}`,
  ].join(" ");
}

function modeLabel(mode: Mode): string {
  if (mode === "chart") return "grid";
  if (mode === "degree") return "degree";
  return "rhythm";
}

function artHint(art: Articulation): string {
  return ARTICULATIONS.find((a) => a.id === art)?.hint ?? art;
}

type LaunchPadProps = {
  index: number;
  mode: Mode;
  sheet: SheetState;
  selected: number;
  currentDegree: number | null;
  barRhythmRow: Articulation[];
  rhyKind: ReturnType<typeof rhythmBarKind>;
  onSelect: () => void;
  onPaintDegree: (degree: number | null) => void;
  onPaintTone: (axisId: ToneAxisId) => void;
  onPaintRhythm: (step: number) => void;
};

/**
 * 고정 슬롯 하나 — key는 부모가 index로 고정.
 * 모드가 바뀌어도 같은 <button> 위에서 라벨·핸들러만 갱신.
 */
function LaunchPad({
  index: i,
  mode,
  sheet,
  selected,
  currentDegree,
  barRhythmRow,
  rhyKind,
  onSelect,
  onPaintDegree,
  onPaintTone,
  onPaintRhythm,
}: LaunchPadProps) {
  if (mode === "chart") {
    const degree = sheet.degrees[i] ?? null;
    return (
      <button
        type="button"
        className={`pad ${selected === i ? "on" : ""} ${degree === null ? "empty" : ""}`}
        onClick={onSelect}
      >
        <span className="pad-ink">
          <span className="pad-sub">{(i % BEATS) + 1}</span>
          <span className="pad-label">
            {slotLabel(sheet.key, degree, sheet.tones[i])}
          </span>
          <span className="pad-roman">{slotRoman(degree)}</span>
        </span>
      </button>
    );
  }

  if (mode === "rhythm") {
    const art = barRhythmRow[i] ?? "rest";
    const beatNo = Math.floor(i / SUBDIV) + 1;
    const sub = i % SUBDIV;
    const subMark = ["1", "e", "&", "a"][sub]!;
    const hit = art === "D" || art === "U" || art === "X";
    return (
      <button
        type="button"
        className={`pad ${art === "rest" ? "empty" : ""} ${hit ? "hit" : ""} ${rhyKind === "link" ? "rhy-link" : ""} ${rhyKind === "own" ? "rhy-own" : ""} ${rhyKind === "base" ? "rhy-base" : ""}`}
        onClick={() => onPaintRhythm(i)}
      >
        <span className="pad-ink">
          <span className="pad-sub">
            {beatNo}
            {subMark}
          </span>
          <span className="pad-label">{artLabel(art)}</span>
          <span className="pad-roman">{artHint(art)}</span>
        </span>
      </button>
    );
  }

  // degree lens
  if (i < 7) {
    const meta = DEGREE_META[i]!;
    const labelTones =
      currentDegree === i
        ? (sheet.tones[selected] ?? defaultTonesForDegree(i))
        : defaultTonesForDegree(i);
    const used = sheet.degrees.includes(i);
    return (
      <button
        type="button"
        className={`pad tool ${currentDegree === i ? "on" : ""} ${used ? "used" : ""}`}
        onClick={() => onPaintDegree(i)}
      >
        <span className="pad-ink">
          <span className="pad-label">{meta.roman}</span>
          <span className="pad-roman">
            {slotLabel(sheet.key, i, labelTones)}
          </span>
        </span>
      </button>
    );
  }

  if (i === 7) {
    return (
      <button
        type="button"
        className={`pad tool ${currentDegree === null ? "on" : ""}`}
        onClick={() => onPaintDegree(null)}
      >
        <span className="pad-ink">
          <span className="pad-label">∅</span>
          <span className="pad-roman"> </span>
        </span>
      </button>
    );
  }

  const axis = TONE_AXES[i - 8];
  if (!axis || currentDegree === null) {
    return (
      <button
        type="button"
        className="pad tone tone-idle"
        disabled
        aria-hidden
        tabIndex={-1}
      >
        <span className="pad-ink" />
      </button>
    );
  }

  const tones = sheet.tones[selected];
  const on = toneAxisOn(tones, axis);
  const label = toneAxisLabel(tones, axis);
  const faces = toneAxisFaces(axis);
  const polarity = toneAxisPolarity(tones, axis);
  return (
    <button
      type="button"
      className={[
        "pad",
        "tone",
        "arcana",
        on ? "on" : "",
        axis.id === "1" ? "tone-root" : "",
        faces.polar ? "polar" : "mirror",
        faces.polar && polarity === "min" ? "reversed" : "",
        faces.polar && polarity === "maj" ? "upright" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={axis.id === "1" ? undefined : () => onPaintTone(axis.id)}
      aria-pressed={on}
      aria-label={label}
    >
      <span className="pad-ink">
        <span className="arcana-face">
          <span className="arcana-end maj">{faces.maj}</span>
          <span className="arcana-rule" aria-hidden />
          <span className="arcana-end min">{faces.min}</span>
        </span>
      </span>
    </button>
  );
}
