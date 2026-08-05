import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyPreset,
  BEATS,
  createInitialSheet,
  DEGREE_META,
  nextKey,
  PRESETS,
  SLOTS,
  slotLabel,
  slotRoman,
  toStrudel,
  VOICES,
  type SheetState,
  type VoiceId,
} from "./sheet";
import { evaluateStrudel, hushStrudel, initStrudelEngine } from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";
type Mode = "degree" | "preset";

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("degree");
  const [engine, setEngine] = useState<EngineState>("idle");
  const [status, setStatus] = useState("차트 준비됨");
  const sheetRef = useRef(sheet);
  const playingRef = useRef(false);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const pushPattern = useCallback(async (next: SheetState) => {
    if (!playingRef.current) return;
    try {
      await evaluateStrudel(toStrudel(next));
    } catch (err) {
      console.error(err);
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
    const ok = await ensureReady();
    if (!ok) return;
    try {
      await evaluateStrudel(toStrudel(sheetRef.current));
      playingRef.current = true;
      setEngine("playing");
      setStatus("재생 중");
    } catch (err) {
      console.error(err);
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

  const playing = engine === "playing";
  const voice = VOICES.find((v) => v.id === sheet.voice) ?? VOICES[0]!;
  const currentDegree = sheet.degrees[selected] ?? null;
  const bar = Math.floor(selected / BEATS) + 1;
  const beat = (selected % BEATS) + 1;

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

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="brand">OneSheet</p>
          <p className="tag">기타 차트 한 장</p>
        </div>
        <p className="pos">
          {bar}마디 · {beat}박
        </p>
      </header>

      <div className="meta">
        <button
          type="button"
          className="chip"
          onClick={() => update((prev) => ({ ...prev, key: nextKey(prev.key) }))}
        >
          <span className="chip-k">조성</span>
          <span className="chip-v">{sheet.key}</span>
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            const i = VOICES.findIndex((v) => v.id === sheet.voice);
            const next = VOICES[(i + 1) % VOICES.length]!;
            update((prev) => ({ ...prev, voice: next.id as VoiceId }));
          }}
        >
          <span className="chip-k">음색</span>
          <span className="chip-v">{voice.label}</span>
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

      <section className="pad-grid" aria-label="차트">
        {Array.from({ length: SLOTS }, (_, i) => {
          const degree = sheet.degrees[i] ?? null;
          const rowBeat = (i % BEATS) + 1;
          return (
            <button
              key={i}
              type="button"
              className={`pad ${selected === i ? "on" : ""} ${degree === null ? "empty" : "idle"}`}
              onClick={() => {
                setSelected(i);
                setMode("degree");
              }}
            >
              <span className="pad-sub">{rowBeat}</span>
              <span className="pad-label">{slotLabel(sheet.key, degree)}</span>
              <span className="pad-roman">{slotRoman(degree)}</span>
            </button>
          );
        })}
      </section>

      {mode === "degree" ? (
        <section className="palette-row" aria-label="도수">
          {DEGREE_META.map((meta, i) => (
            <button
              key={meta.roman}
              type="button"
              className={`swatch ${currentDegree === i ? "on" : ""} ${sheet.degrees.includes(i) ? "used" : ""}`}
              onClick={() => paintDegree(i)}
            >
              <span className="swatch-top">{meta.roman}</span>
              <span className="swatch-bot">{slotLabel(sheet.key, i)}</span>
            </button>
          ))}
          <button
            type="button"
            className={`swatch ${currentDegree === null ? "on" : ""}`}
            onClick={() => paintDegree(null)}
          >
            <span className="swatch-top">rest</span>
            <span className="swatch-bot">—</span>
          </button>
        </section>
      ) : (
        <section className="palette-row presets" aria-label="진행 프리셋">
          {PRESETS.map((preset) => {
            const applied = applyPreset(preset.bar);
            const active = applied.every((d, idx) => d === sheet.degrees[idx]);
            return (
              <button
                key={preset.id}
                type="button"
                className={`swatch preset ${active ? "on" : ""}`}
                onClick={() => update((prev) => ({ ...prev, degrees: applyPreset(preset.bar) }))}
              >
                <span className="swatch-top">{preset.name}</span>
                <span className="swatch-bot">{preset.label}</span>
              </button>
            );
          })}
        </section>
      )}

      <p className="status">{status}</p>

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
          <span className="tr-label">메트로놈</span>
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
          className={`tr-btn ${mode === "preset" ? "on" : ""}`}
          onClick={() => setMode("preset")}
        >
          <span className="tr-icon">⌘</span>
          <span className="tr-label">진행</span>
        </button>
      </nav>
    </div>
  );
}
