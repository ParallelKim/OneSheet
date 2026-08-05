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
  const [status, setStatus] = useState("차트 준비됨");
  /** 재생 헤드: 4분 슬롯 0–15 (null = 정지) — 텍스트용 */
  const [playSlot, setPlaySlot] = useState<number | null>(null);
  const sheetRef = useRef(sheet);
  const playingRef = useRef(false);
  const selectedRef = useRef(selected);
  const staffRef = useRef<HTMLDivElement>(null);
  const padStageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Strudel 사이클 → 백레이어 CSS 변수 (셀 클래스 하이라이트 없음)
  useEffect(() => {
    if (engine !== "playing") {
      setPlaySlot(null);
      staffRef.current?.style.setProperty("--play-phase", "-1");
      padStageRef.current?.style.setProperty("--play-on", "0");
      padStageRef.current?.style.setProperty("--play-step-on", "0");
      return;
    }
    let raf = 0;
    const tick = () => {
      const phase = getCyclePhase();
      if (phase !== null) {
        const slot = Math.min(SLOTS - 1, Math.floor(phase * SLOTS));
        const step = Math.min(TOTAL_STEPS - 1, Math.floor(phase * TOTAL_STEPS));
        const barIdx = Math.floor(slot / BEATS);
        const editBar = Math.floor(selectedRef.current / BEATS);
        setPlaySlot((prev) => (prev === slot ? prev : slot));
        const staff = staffRef.current;
        if (staff) {
          staff.style.setProperty("--play-phase", phase.toFixed(5));
          staff.style.setProperty("--mark-bar", String(barIdx));
        }
        const el = padStageRef.current;
        if (el) {
          el.style.setProperty("--play-on", "1");
          el.style.setProperty("--mark-bar", String(barIdx));
          el.style.setProperty("--play-col", String(slot % BEATS));
          el.style.setProperty("--play-row", String(barIdx));
          el.style.setProperty("--play-step-col", String(step % BEATS));
          el.style.setProperty("--play-step-row", String(Math.floor((step % BAR_STEPS) / BEATS)));
          el.style.setProperty("--play-step-on", barIdx === editBar ? "1" : "0");
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
        setStatus("정지");
      }
    } catch (err) {
      console.error(err, getLastStrudelCode());
      setEngine("error");
      setStatus("재생할 수 없는 진행입니다");
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
    setStatus("소리 장치 연결 중…");
    try {
      await initStrudelEngine();
      setEngine("ready");
      return true;
    } catch (err) {
      console.error(err);
      setEngine("error");
      setStatus("소리 장치를 열 수 없습니다");
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
        setStatus("정지");
        return;
      }
      playingRef.current = true;
      setEngine("playing");
      setStatus("재생 중");
    } catch (err) {
      console.error(err, getLastStrudelCode());
      playingRef.current = false;
      setEngine("error");
      setStatus("재생에 실패했습니다");
    }
  }, [ensureReady]);

  const onStop = useCallback(() => {
    hushStrudel();
    playingRef.current = false;
    setEngine((e) => (e === "error" ? e : "ready"));
    setStatus("정지");
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

  return (
    <div className="app">
      <header className="top">
        <p className="brand">OneSheet</p>
        <p className={`pos ${playing ? "playing" : ""}`}>
          {playing && playBar !== null && playBeat !== null
            ? `▶ ${playBar + 1}마디 · ${playBeat}박`
            : `${bar + 1}마디 · ${beat}박`}
        </p>
      </header>

      <section className="lcd" aria-label="상태">
        <div className="lcd-meta">
          <button
            type="button"
            className="chip"
            onClick={() => update((prev) => ({ ...prev, key: nextKey(prev.key) }))}
          >
            <span className="chip-k">조성</span>
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
        </div>

        <div
          ref={staffRef}
          className={`staff ${playing ? "is-playing" : ""}`}
          aria-label="차트"
          style={{ "--mark-bar": markBar } as CSSProperties}
        >
          <div className="staff-back" aria-hidden>
            <div className="ind-measure" />
            <div className="ind-head" />
          </div>
          <div className="staff-front">
            {Array.from({ length: BARS }, (_, bi) => (
              <div
                key={bi}
                className="measure"
                role="group"
                aria-label={`${bi + 1}마디`}
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
                        aria-label={`${bi + 1}마디 ${qi + 1}박`}
                      >
                        <span className="chord-name">{slotLabel(sheet.key, d)}</span>
                        {on && d !== null ? <span className="degree-dot">{slotRoman(d)}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="measure-rail" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="transport" aria-label="공통 조작">
        <button
          type="button"
          className={`tr-btn play ${playing ? "on" : ""}`}
          onClick={() => void (playing ? onStop() : onPlay())}
          aria-label={playing ? "일시정지" : "재생"}
        >
          <span className="tr-icon">{playing ? "■" : "▶"}</span>
          <span className="tr-label">{playing ? "정지" : "재생"}</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${sheet.metro ? "on" : ""}`}
          onClick={() => update((prev) => ({ ...prev, metro: !prev.metro }))}
          aria-pressed={sheet.metro}
        >
          <span className="tr-icon">♩</span>
          <span className="tr-label">메트로</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "chart" ? "on" : ""}`}
          onClick={() => setMode("chart")}
        >
          <span className="tr-icon">▦</span>
          <span className="tr-label">차트</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "degree" ? "on" : ""}`}
          onClick={() => setMode("degree")}
        >
          <span className="tr-icon">I</span>
          <span className="tr-label">도수</span>
        </button>
        <button
          type="button"
          className={`tr-btn ${mode === "rhythm" ? "on" : ""}`}
          onClick={() => setMode("rhythm")}
        >
          <span className="tr-icon">♩♪</span>
          <span className="tr-label">리듬</span>
        </button>
      </nav>

      {mode === "rhythm" && (
        <div className="brush-row" aria-label="주법">
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
              <div className="pad-ind pad-ind-play" />
            </>
          )}
          {mode === "rhythm" && <div className="pad-ind pad-ind-play-step" />}
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
                  <span className="pad-roman">
                    {art === "hold" ? "링" : art === "rest" ? "쉼" : art === "X" ? "뮤트" : art === "D" ? "다운" : "업"}
                  </span>
                </button>
              );
            })}
        </section>
      </div>

      <p className="status">
        {playing && playBar !== null && playBeat !== null
          ? `재생 중 · ${playBar + 1}마디 ${playBeat}박`
          : mode === "rhythm"
            ? `${bar + 1}마디 리듬 · 탭으로 ${brushLabel(brush)}`
            : status}
      </p>
    </div>
  );
}

function modeLabel(mode: Mode): string {
  if (mode === "chart") return "차트";
  if (mode === "degree") return "도수";
  return "리듬";
}

function brushLabel(art: Articulation): string {
  return ARTICULATIONS.find((a) => a.id === art)?.hint ?? art;
}
