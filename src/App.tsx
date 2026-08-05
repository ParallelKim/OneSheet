import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialSheet,
  KEY_ROOTS,
  nextHit,
  nextKey,
  QUALITIES,
  ROOTS,
  slotHint,
  slotLabel,
  toStrudel,
  VOICES,
  type ChordSlot,
  type Quality,
  type SheetState,
  type VoiceId,
} from "./sheet";
import { evaluateStrudel, hushStrudel, initStrudelEngine } from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [selected, setSelected] = useState(0);
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

  const current = sheet.chords[selected] ?? null;
  const keyRoots = KEY_ROOTS[sheet.key] ?? KEY_ROOTS.C!;

  const patchSlot = (recipe: (prev: ChordSlot | null) => ChordSlot | null) => {
    update((prev) => {
      const chords = [...prev.chords];
      chords[selected] = recipe(chords[selected] ?? null);
      return { ...prev, chords };
    });
  };

  const setRoot = (root: string) => {
    patchSlot((prev) => ({
      root,
      quality: prev?.quality ?? "maj",
    }));
  };

  const setQuality = (quality: Quality) => {
    patchSlot((prev) => {
      if (!prev) return { root: "C", quality };
      return { ...prev, quality };
    });
  };

  const clearSlot = () => {
    patchSlot(() => null);
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="brand">OneSheet</p>
          <p className="tag">기타 차트 한 장</p>
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
        <button
          type="button"
          className="key-chip"
          onClick={() => update((prev) => ({ ...prev, key: nextKey(prev.key) }))}
        >
          <span className="ctrl-label">조성</span>
          <span className="ctrl-value">{sheet.key}</span>
        </button>
        <p className="key-hint">스케일 근음을 밝게 표시합니다</p>
      </div>

      <section className="chords" aria-label="코드 진행">
        {sheet.chords.map((chord, i) => (
          <button
            key={i}
            type="button"
            className={`chord ${chord ? "" : "empty"} ${selected === i ? "on" : ""}`}
            onClick={() => setSelected(i)}
          >
            <span className="chord-i">
              {i + 1}
              {chord ? ` · ${slotHint(chord)}` : " · rest"}
            </span>
            <span className="chord-v">{slotLabel(chord)}</span>
          </button>
        ))}
      </section>

      <section className="editor" aria-label="코드 편집">
        <div className="edit-block">
          <p className="edit-label">근음</p>
          <div className="root-row">
            {ROOTS.map((root) => {
              const inKey = keyRoots.includes(root);
              const on = current?.root === root;
              return (
                <button
                  key={root}
                  type="button"
                  className={`root ${on ? "on" : ""} ${inKey ? "in-key" : "out"}`}
                  onClick={() => setRoot(root)}
                >
                  {root}
                </button>
              );
            })}
          </div>
        </div>

        <div className="edit-block">
          <p className="edit-label">화음</p>
          <div className="qual-row">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                type="button"
                className={`qual ${current?.quality === q.id ? "on" : ""}`}
                onClick={() => setQuality(q.id)}
                title={q.hint}
              >
                {q.label}
              </button>
            ))}
            <button
              type="button"
              className={`qual rest ${current === null ? "on" : ""}`}
              onClick={clearSlot}
              title="쉼표"
            >
              rest
            </button>
          </div>
        </div>
      </section>

      <section className="beats" aria-label="리듬">
        <p className="beats-label">리듬</p>
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
                aria-label={`${i + 1}박 ${empty ? "쉼" : hit}`}
              >
                <span>{empty ? "" : hit}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="controls" aria-label="음색과 템포">
        <div className="voice-row">
          <span className="ctrl-label">음색</span>
          <div className="voices">
            {VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`voice ${sheet.voice === v.id ? "on" : ""}`}
                onClick={() => update((prev) => ({ ...prev, voice: v.id as VoiceId }))}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <label className="tempo">
          <span className="ctrl-label">BPM</span>
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
      </footer>
    </div>
  );
}
