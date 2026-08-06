import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ARTICULATIONS,
  artLabel,
  barIndex,
  BEATS,
  BARS,
  BAR_STEPS,
  createInitialSheet,
  DEGREE_META,
  nextKey,
  setBarArticulation,
  SLOTS,
  slotLabel,
  slotRoman,
  SUBDIV,
  TOTAL_STEPS,
  toStrudel,
  type Articulation,
  type SheetState,
} from "./sheet";
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
} from "./engine";
import { getAudioContext } from "@strudel/web";
import "./App.css";

type EngineState = "idle" | "loading" | "ready" | "playing" | "error";
/** 렌즈: 같은 4×4 패드의 의미를 바꾼다 */
type Mode = "chart" | "degree" | "rhythm";

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

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("chart");
  const [brush, setBrush] = useState<Articulation>("D");
  const [engine, setEngine] = useState<EngineState>("idle");
  const [status, setStatus] = useState("");
  /** 재생 헤드: 4분 슬롯 0–15 (null = 정지) — 텍스트용 */
  const [playSlot, setPlaySlot] = useState<number | null>(null);
  const sheetRef = useRef(sheet);
  const playingRef = useRef(false);
  const staffRef = useRef<HTMLDivElement>(null);
  const padStageRef = useRef<HTMLDivElement>(null);
  const padBoardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  // 엔진은 마운트 직후 백그라운드 기동 (Play를 기다리지 않음)
  useEffect(() => {
    void initStrudelEngine().catch((err) => console.warn("engine boot", err));
  }, []);

  // 첫 포인터에서 오디오 unlock
  useEffect(() => {
    const onFirstPointer = () => {
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
      const ok = await evaluateStrudel(toStrudel(next));
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
  }, []);

  const update = useCallback(
    (recipe: (prev: SheetState) => SheetState) => {
      setSheet((prev) => {
        const next = recipe(prev);
        void pushPattern(next);
        return next;
      });
    },
    [pushPattern],
  );

  const onPlay = useCallback(() => {
    const gate = getPlaybackEpoch();
    try {
      void (getAudioContext() as AudioContext).resume();
    } catch {
      /* ignore */
    }

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
        const code = toStrudel(sheetRef.current);
        const ok = await evaluateStrudel(code);
        if (!ok || getPlaybackEpoch() !== gate) {
          playingRef.current = false;
          setEngine((e) => (e === "error" ? e : "ready"));
          setStatus("");
          return;
        }
        playingRef.current = true;
        setEngine("playing");
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
  }, []);

  const onStop = useCallback(() => {
    hushStrudel();
    playingRef.current = false;
    setEngine((e) => (e === "error" ? e : "ready"));
    setStatus("");
  }, []);

  const paintDegree = (degree: number | null) => {
    update((prev) => {
      const degrees = [...prev.degrees];
      if (degree !== null && degrees[selected] === degree) {
        degrees[selected] = null;
      } else {
        degrees[selected] = degree;
      }
      return { ...prev, degrees };
    });
  };

  const paintRhythm = (step: number) => {
    const bar = barIndex(selected);
    update((prev) => {
      const current = prev.rhythm[bar]?.[step] ?? "rest";
      const nextArt = current === brush ? "rest" : brush;
      return {
        ...prev,
        rhythm: setBarArticulation(prev.rhythm, bar, step, nextArt),
      };
    });
  };

  const selectBar = (bar: number) => {
    setSelected(bar * BEATS + (selected % BEATS));
  };

  const playing = engine === "playing";
  const loading = engine === "loading";
  const currentDegree = sheet.degrees[selected] ?? null;
  const bar = barIndex(selected);
  const beat = (selected % BEATS) + 1;
  const barRhythm = sheet.rhythm[bar] ?? [];
  const playBar = playSlot !== null ? barIndex(playSlot) : null;
  const playBeat = playSlot !== null ? (playSlot % BEATS) + 1 : null;
  /** 하이라이트할 마디: 재생 중이면 재생 마디, 아니면 선택 마디 */
  const markBar = playBar ?? bar;
  const posBar = playBar ?? bar;
  const posBeat = playBeat ?? beat;

  return (
    <div className="app">
      <section className="lcd" aria-label="lcd">
        <div className="lcd-meta">
          <button
            type="button"
            className="chip"
            onClick={() => update((prev) => ({ ...prev, key: nextKey(prev.key) }))}
          >
            <span className="chip-k">KEY</span>
            <span className="chip-v">{sheet.key}</span>
          </button>
          <label className="chip tempo-chip">
            <span className="chip-k">BPM</span>
            <input
              type="range"
              min={70}
              max={140}
              step={1}
              value={sheet.bpm}
              onChange={(e) => update((prev) => ({ ...prev, bpm: Number(e.target.value) }))}
            />
            <span className="chip-v">{sheet.bpm}</span>
          </label>
          <p className={`pos ${playing ? "playing" : ""}`} aria-label="position">
            <span className="pos-bar">|{posBar + 1}|</span>
            <span className="pos-beat">{posBeat}</span>
          </p>
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
                className="measure"
                role="group"
                aria-label={`bar ${bi + 1}`}
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
                        setSelected(i);
                      }}
                      aria-label={`bar ${bi + 1} beat ${qi + 1}`}
                    >
                      <span className="chord-name">{slotLabel(sheet.key, d)}</span>
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
            // click보다 이른 제스처에서 unlock
            if (playing || loading) return;
            try {
              void (getAudioContext() as AudioContext).resume();
            } catch {
              /* ignore */
            }
          }}
          onClick={() => void (playing || loading ? onStop() : onPlay())}
          aria-label={loading ? "loading" : playing ? "stop" : "play"}
          aria-busy={loading}
        >
          <span className="tr-icon" aria-hidden>
            {loading ? <span className="spin" /> : playing ? "■" : "▶"}
          </span>
          <span className="tr-label">
            {loading ? "LOAD" : playing ? "STOP" : "PLAY"}
          </span>
        </button>
        <button
          type="button"
          className={`tr-btn ${sheet.metro ? "on" : ""}`}
          onClick={() => update((prev) => ({ ...prev, metro: !prev.metro }))}
          aria-pressed={sheet.metro}
          aria-label="metronome"
        >
          <span className="tr-icon">♩</span>
          <span className="tr-label">CLICK</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "chart" ? "on" : ""}`}
          onClick={() => setMode("chart")}
          aria-label="chart"
        >
          <span className="tr-icon">▦</span>
          <span className="tr-label">GRID</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "degree" ? "on" : ""}`}
          onClick={() => setMode("degree")}
          aria-label="degree"
        >
          <span className="tr-icon">I</span>
          <span className="tr-label">DEG</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "rhythm" ? "on" : ""}`}
          onClick={() => setMode("rhythm")}
          aria-label="rhythm"
        >
          <span className="tr-icon">♩♪</span>
          <span className="tr-label">RHY</span>
        </button>
      </nav>

      {mode === "rhythm" && (
        <div className="brush-row" aria-label="articulation">
          {ARTICULATIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`brush ${brush === a.id ? "on" : ""}`}
              onClick={() => setBrush(a.id)}
            >
              <span className="brush-mark">{a.label}</span>
              <span className="brush-hint">{a.hint}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={padStageRef}
        className={`pad-stage ${playing ? "is-playing" : ""} mode-${mode}`}
        style={{ "--mark-bar": markBar } as CSSProperties}
      >
        <div className="pad-board" ref={padBoardRef}>
          <div className="pad-back" aria-hidden>
            {mode === "chart" && <div className="pad-ind pad-ind-bar" />}
          </div>
          {/* 재생 링: main + 행 wrap(prev/next)로 오른쪽↔왼쪽 이어짐 */}
          {mode === "chart" && (
            <div className="pad-play" aria-hidden>
              <div className="pad-play-orb pad-play-orb-chart pad-play-orb-prev" />
              <div className="pad-play-orb pad-play-orb-chart pad-play-orb-main" />
              <div className="pad-play-orb pad-play-orb-chart pad-play-orb-next" />
            </div>
          )}
          {mode === "rhythm" && playBar === bar && (
            <div className="pad-play pad-play-rhythm" aria-hidden>
              <div className="pad-play-orb pad-play-orb-rhythm pad-play-orb-prev" />
              <div className="pad-play-orb pad-play-orb-rhythm pad-play-orb-main" />
              <div className="pad-play-orb pad-play-orb-rhythm pad-play-orb-next" />
            </div>
          )}
          <section className="pad-grid" aria-label={modeLabel(mode)}>
            {mode === "chart" &&
              Array.from({ length: SLOTS }, (_, i) => {
                const degree = sheet.degrees[i] ?? null;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`pad ${selected === i ? "on" : ""} ${degree === null ? "empty" : ""}`}
                    onClick={() => setSelected(i)}
                  >
                    <span className="pad-sub">{(i % BEATS) + 1}</span>
                    <span className="pad-label">{slotLabel(sheet.key, degree)}</span>
                    <span className="pad-roman">{slotRoman(degree)}</span>
                  </button>
                );
              })}

            {mode === "degree" &&
              Array.from({ length: SLOTS }, (_, i) => {
                if (i < 7) {
                  const meta = DEGREE_META[i]!;
                  return (
                    <button
                      key={meta.roman}
                      type="button"
                      className={`pad tool ${currentDegree === i ? "on" : ""} ${sheet.degrees.includes(i) ? "used" : ""}`}
                      onClick={() => paintDegree(i)}
                    >
                      <span className="pad-label">{meta.roman}</span>
                      <span className="pad-roman">{slotLabel(sheet.key, i)}</span>
                    </button>
                  );
                }
                if (i === 7) {
                  return (
                    <button
                      key="rest"
                      type="button"
                      className={`pad tool ${currentDegree === null ? "on" : ""}`}
                      onClick={() => paintDegree(null)}
                    >
                      <span className="pad-label">rest</span>
                      <span className="pad-roman">—</span>
                    </button>
                  );
                }
                return <div key={`ghost-${i}`} className="pad ghost" aria-hidden />;
              })}

            {mode === "rhythm" &&
              Array.from({ length: BAR_STEPS }, (_, step) => {
                const art = barRhythm[step] ?? "rest";
                const beatNo = Math.floor(step / SUBDIV) + 1;
                const sub = step % SUBDIV;
                const subMark = ["1", "e", "&", "a"][sub]!;
                return (
                  <button
                    key={step}
                    type="button"
                    className={`pad ${art === "rest" ? "empty" : ""} ${art === "D" || art === "U" || art === "X" ? "hit" : ""}`}
                    onClick={() => paintRhythm(step)}
                  >
                    <span className="pad-sub">
                      {beatNo}
                      {subMark}
                    </span>
                    <span className="pad-label">{artLabel(art)}</span>
                    <span className="pad-roman">{artHint(art)}</span>
                  </button>
                );
              })}
          </section>
        </div>
      </div>

      {status ? <p className="status">{status}</p> : null}
    </div>
  );
}

function modeLabel(mode: Mode): string {
  if (mode === "chart") return "grid";
  if (mode === "degree") return "degree";
  return "rhythm";
}

function artHint(art: Articulation): string {
  return ARTICULATIONS.find((a) => a.id === art)?.hint ?? art;
}
