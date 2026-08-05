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
  toStrudel,
  type Articulation,
  type SheetState,
} from "./sheet";
import {
  evaluateStrudel,
  getCyclePhase,
  getLastStrudelCode,
  hushStrudel,
  initStrudelEngine,
} from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";
/** 렌즈: 같은 4×4 패드의 의미를 바꾼다 */
type Mode = "chart" | "degree" | "rhythm";

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

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  // Strudel 사이클 → 백레이어 CSS 변수 (셀 클래스 하이라이트 없음)
  useEffect(() => {
    if (engine !== "playing") {
      setPlaySlot(null);
      staffRef.current?.style.setProperty("--play-phase", "-1");
      return;
    }
    let raf = 0;
    const tick = () => {
      const phase = getCyclePhase();
      if (phase !== null) {
        const slot = Math.min(SLOTS - 1, Math.floor(phase * SLOTS));
        const barIdx = Math.floor(slot / BEATS);
        setPlaySlot((prev) => (prev === slot ? prev : slot));
        const staff = staffRef.current;
        if (staff) {
          staff.style.setProperty("--play-phase", phase.toFixed(5));
          staff.style.setProperty("--mark-bar", String(barIdx));
        }
        padStageRef.current?.style.setProperty("--mark-bar", String(barIdx));
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

  const ensureReady = useCallback(async () => {
    if (engine === "ready" || engine === "playing") return true;
    setStatus("audio…");
    try {
      await initStrudelEngine();
      setEngine("ready");
      setStatus("");
      return true;
    } catch (err) {
      console.error(err);
      setEngine("error");
      setStatus("audio error");
      return false;
    }
  }, [engine]);

  const onPlay = useCallback(async () => {
    const okReady = await ensureReady();
    if (!okReady) return;
    try {
      const code = toStrudel(sheetRef.current);
      const ok = await evaluateStrudel(code);
      if (!ok) {
        // 평가 중 정지된 경우
        playingRef.current = false;
        setEngine("ready");
        setStatus("");
        return;
      }
      playingRef.current = true;
      setEngine("playing");
      setStatus("");
    } catch (err) {
      console.error(err, getLastStrudelCode());
      playingRef.current = false;
      setEngine("error");
      setStatus("play error");
    }
  }, [ensureReady]);

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
          style={
            {
              "--mark-bar": markBar,
              "--sel-slot": selected,
            } as CSSProperties
          }
        >
          <div className="staff-back" aria-hidden>
            <div className="ind-measure" />
            <div className="ind-sel" />
            <div className="ind-playbar">
              <div className="ind-playbar-fill" />
            </div>
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
                <div className="measure-chords">
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
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="transport" aria-label="transport">
        <button
          type="button"
          className={`tr-btn play ${playing ? "on" : ""}`}
          onClick={() => void (playing ? onStop() : onPlay())}
          aria-label={playing ? "stop" : "play"}
        >
          <span className="tr-icon">{playing ? "■" : "▶"}</span>
          <span className="tr-label">{playing ? "STOP" : "PLAY"}</span>
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
        style={
          {
            "--sel-col": selected % BEATS,
            "--sel-row": Math.floor(selected / BEATS),
            "--mark-bar": markBar,
          } as CSSProperties
        }
      >
        <div className="pad-back" aria-hidden>
          {mode === "chart" && (
            <>
              <div className="pad-ind pad-ind-bar" />
              <div className="pad-ind pad-ind-sel" />
            </>
          )}
        </div>
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
