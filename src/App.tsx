import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialSheet,
  nextChord,
  nextHit,
  nextSound,
  toStrudel,
  type SheetState,
} from "./sheet";
import { evaluateStrudel, hushStrudel, initStrudelEngine } from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [engine, setEngine] = useState<EngineState>("idle");
  const [status, setStatus] = useState("재생을 눌러 들어보세요");
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
      setStatus("패턴 오류");
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
    setStatus("엔진 준비…");
    try {
      await initStrudelEngine();
      setEngine("ready");
      return true;
    } catch (err) {
      console.error(err);
      setEngine("error");
      setStatus("엔진 실패");
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
      setStatus("재생 중 · 만지면 바로 바뀝니다");
    } catch (err) {
      console.error(err);
      playingRef.current = false;
      setEngine("error");
      setStatus("재생 실패");
    }
  }, [ensureReady]);

  const onStop = useCallback(() => {
    hushStrudel();
    playingRef.current = false;
    setEngine((e) => (e === "error" ? e : "ready"));
    setStatus("정지");
  }, []);

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="brand">OneSheet</p>
          <p className="tag">만지고, 바로 듣는 한 장</p>
        </div>
        <button
          type="button"
          className={`play ${engine === "playing" ? "on" : ""}`}
          onClick={() => void (engine === "playing" ? onStop() : onPlay())}
          aria-label={engine === "playing" ? "정지" : "재생"}
        >
          {engine === "playing" ? "■" : "▶"}
        </button>
      </header>

      <section className="chords" aria-label="코드">
        {sheet.chords.map((chord, i) => {
          const empty = chord === "-";
          return (
            <button
              key={i}
              type="button"
              className={`chord ${empty ? "empty" : ""}`}
              onClick={() =>
                update((prev) => {
                  const chords = [...prev.chords];
                  chords[i] = nextChord(chords[i]!);
                  return { ...prev, chords };
                })
              }
            >
              <span className="chord-i">{i + 1}</span>
              <span className="chord-v">{empty ? "—" : chord}</span>
            </button>
          );
        })}
      </section>

      <section className="beats" aria-label="비트">
        <p className="beats-label">비트</p>
        <div className="beat-row">
          {sheet.beats.map((hit, i) => {
            const empty = hit === "~";
            return (
              <button
                key={i}
                type="button"
                className={`dot ${empty ? "empty" : "hit"}`}
                onClick={() =>
                  update((prev) => {
                    const beats = [...prev.beats];
                    beats[i] = nextHit(beats[i]!);
                    return { ...prev, beats };
                  })
                }
                aria-label={`비트 ${i + 1} ${empty ? "쉼" : hit}`}
              >
                <span>{empty ? "" : hit}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="controls" aria-label="소리">
        <button
          type="button"
          className="sound"
          onClick={() => update((prev) => ({ ...prev, sound: nextSound(prev.sound) }))}
        >
          <span className="ctrl-label">소리</span>
          <span className="ctrl-value">{sheet.sound}</span>
        </button>

        <label className="tempo">
          <span className="ctrl-label">템포</span>
          <input
            type="range"
            min={70}
            max={140}
            step={1}
            value={sheet.bpm}
            onChange={(e) => update((prev) => ({ ...prev, bpm: Number(e.target.value) }))}
          />
          <span className="ctrl-value">{sheet.bpm}</span>
        </label>
      </section>

      <footer className="foot">
        <p className="status">{status}</p>
        <p className="hint">코드·비트를 탭하면 바뀝니다</p>
      </footer>
    </div>
  );
}
