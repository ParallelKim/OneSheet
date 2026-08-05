import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialSheet,
  degreeOf,
  DEGREES,
  nextHit,
  nextKey,
  nextSound,
  paletteFor,
  remapChordsToKey,
  toStrudel,
  type SheetState,
} from "./sheet";
import { evaluateStrudel, hushStrudel, initStrudelEngine } from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [selected, setSelected] = useState(0);
  const [engine, setEngine] = useState<EngineState>("idle");
  const [status, setStatus] = useState("칸을 고르고, 도수를 칠하세요");
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
      setStatus("재생 중 · 칠하면 바로 바뀝니다");
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

  const palette = paletteFor(sheet.key);

  const paint = (chord: string) => {
    update((prev) => {
      const chords = [...prev.chords];
      chords[selected] = chord;
      return { ...prev, chords };
    });
    // 다음 칸으로 자연스럽게 이동
    setSelected((s) => (s + 1) % sheet.chords.length);
  };

  const changeKey = () => {
    update((prev) => {
      const key = nextKey(prev.key);
      return {
        ...prev,
        key,
        chords: remapChordsToKey(prev.chords, prev.key, key),
      };
    });
  };

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

      <div className="key-row">
        <button type="button" className="key-chip" onClick={changeKey}>
          <span className="ctrl-label">조</span>
          <span className="ctrl-value">{sheet.key}</span>
        </button>
        <p className="key-hint">이 조 도수만 쓸 수 있어요</p>
      </div>

      <section className="chords" aria-label="코드 슬롯">
        {sheet.chords.map((chord, i) => {
          const empty = chord === "-";
          const deg = degreeOf(sheet.key, chord);
          return (
            <button
              key={i}
              type="button"
              className={`chord ${empty ? "empty" : ""} ${selected === i ? "on" : ""}`}
              onClick={() => setSelected(i)}
            >
              <span className="chord-i">{i + 1}{deg ? ` · ${deg}` : ""}</span>
              <span className="chord-v">{empty ? "—" : chord}</span>
            </button>
          );
        })}
      </section>

      <section className="palette" aria-label="도수 팔레트">
        <p className="palette-label">도수</p>
        <div className="palette-row">
          {palette.map((chord, i) => (
            <button
              key={chord}
              type="button"
              className={`swatch deg-${i}`}
              onClick={() => paint(chord)}
            >
              <span className="swatch-deg">{DEGREES[i]}</span>
              <span className="swatch-chord">{chord}</span>
            </button>
          ))}
          <button type="button" className="swatch rest" onClick={() => paint("-")}>
            <span className="swatch-deg">—</span>
            <span className="swatch-chord">쉼</span>
          </button>
        </div>
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
        <p className="hint">슬롯 선택 → 도수 탭 · 조 바꾸면 도수 유지</p>
      </footer>
    </div>
  );
}
