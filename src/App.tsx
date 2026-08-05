import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyLayer,
  createInitialSheet,
  HARMONY_CHORDS,
  HARMONY_SOUNDS,
  BEAT_SOUNDS,
  isHarmonyLayer,
  toStrudel,
  type Layer,
  type Lens,
  type SheetState,
} from "./sheet";
import { evaluateStrudel, hushStrudel, initStrudelEngine } from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";

function MiniBar({ layer }: { layer: Layer }) {
  const compact = layer.steps
    .map((s) => (s === "~" || s === "-" ? "·" : s.length > 3 ? s.slice(0, 2) : s))
    .join(" ");
  return (
    <div className={`mini ${layer.kind} ${layer.muted ? "is-muted" : ""}`}>
      <span className="mini-tag">{layer.kind === "harmony" ? "H" : "B"}</span>
      <code className="mini-code">{compact}</code>
      <span className="mini-snd">{layer.sound}</span>
    </div>
  );
}

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [activeLayerId, setActiveLayerId] = useState(() => createInitialSheet().layers[0].id);
  const [lens, setLens] = useState<Lens>("steps");
  const [engine, setEngine] = useState<EngineState>("idle");
  const [status, setStatus] = useState("탭해서 시작");
  const sheetRef = useRef(sheet);
  const playingRef = useRef(false);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const layer = useMemo(
    () => sheet.layers.find((l) => l.id === activeLayerId) ?? sheet.layers[0],
    [sheet.layers, activeLayerId],
  );

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

  const updateSheet = useCallback(
    (recipe: (prev: SheetState) => SheetState) => {
      setSheet((prev) => {
        const next = recipe(prev);
        void pushPattern(next);
        return next;
      });
    },
    [pushPattern],
  );

  const patchLayer = useCallback(
    (id: string, patch: Partial<Layer> | ((l: Layer) => Layer)) => {
      updateSheet((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== id) return l;
          return typeof patch === "function" ? patch(l) : { ...l, ...patch };
        }),
      }));
    },
    [updateSheet],
  );

  const ensureReady = useCallback(async () => {
    if (engine === "ready" || engine === "playing") return true;
    setStatus("엔진 준비…");
    try {
      await initStrudelEngine();
      setEngine("ready");
      setStatus("준비됨");
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
      setStatus("재생 중");
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

  const addLayer = (kind: Layer["kind"]) => {
    const next = createEmptyLayer(kind);
    updateSheet((prev) => ({ ...prev, layers: [...prev.layers, next] }));
    setActiveLayerId(next.id);
    setLens("steps");
  };

  const removeLayer = (id: string) => {
    if (sheet.layers.length <= 1) return;
    updateSheet((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
    if (activeLayerId === id) {
      const rest = sheet.layers.filter((l) => l.id !== id);
      setActiveLayerId(rest[0]?.id ?? "");
    }
  };

  const cycleStep = (index: number) => {
    if (!layer) return;
    patchLayer(layer.id, (l) => {
      const steps = [...l.steps];
      if (isHarmonyLayer(l)) {
        const i = HARMONY_CHORDS.indexOf(steps[index] as (typeof HARMONY_CHORDS)[number]);
        const next = i < 0 ? 0 : (i + 1) % HARMONY_CHORDS.length;
        steps[index] = HARMONY_CHORDS[next];
      } else {
        const palette = ["~", l.sound, "bd", "sd", "hh", "oh", "cp"] as const;
        const cur = steps[index];
        const i = palette.indexOf(cur as (typeof palette)[number]);
        steps[index] = palette[(i < 0 ? 0 : i + 1) % palette.length];
      }
      return { ...l, steps };
    });
  };

  const clearStep = (index: number) => {
    if (!layer) return;
    patchLayer(layer.id, (l) => {
      const steps = [...l.steps];
      steps[index] = isHarmonyLayer(l) ? "-" : "~";
      return { ...l, steps };
    });
  };

  const sounds = layer && isHarmonyLayer(layer) ? HARMONY_SOUNDS : BEAT_SOUNDS;

  return (
    <div className="app">
      <header className="top">
        <div className="brand-block">
          <p className="brand">OneSheet</p>
          <p className="tag">스트루델을 한 장으로</p>
        </div>
        <button
          type="button"
          className={`play ${engine === "playing" ? "on" : ""}`}
          onClick={() => void (engine === "playing" ? onStop() : onPlay())}
        >
          {engine === "playing" ? "■" : "▶"}
        </button>
      </header>

      <section className="stack-read" aria-label="패턴 미리보기">
        {sheet.layers.map((l) => (
          <MiniBar key={l.id} layer={l} />
        ))}
      </section>

      <section className="layers" aria-label="레이어">
        <div className="layer-row">
          {sheet.layers.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`layer-chip ${l.id === activeLayerId ? "on" : ""} ${l.kind} ${l.muted ? "muted" : ""}`}
              onClick={() => setActiveLayerId(l.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                removeLayer(l.id);
              }}
            >
              <span className="lc-kind">{l.kind === "harmony" ? "화음" : "비트"}</span>
              <span className="lc-snd">{l.sound}</span>
            </button>
          ))}
          <button type="button" className="layer-add" onClick={() => addLayer("harmony")} title="화음 레이어">
            +H
          </button>
          <button type="button" className="layer-add" onClick={() => addLayer("beat")} title="비트 레이어">
            +B
          </button>
        </div>
      </section>

      {layer && (
        <>
          <nav className="lenses" aria-label="편집 렌즈">
            {(
              [
                ["steps", "스텝", isHarmonyLayer(layer) ? "코드 토큰" : "히트"],
                ["sound", "사운드", "샘플·웨이브"],
                ["fx", "텍스처", "게인·스파이스"],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className={`lens ${lens === id ? "on" : ""}`}
                onClick={() => setLens(id)}
              >
                <span className="lens-label">{label}</span>
                <span className="lens-hint">{hint}</span>
              </button>
            ))}
          </nav>

          <section className="surface" aria-label="편집 표면">
            {lens === "steps" && (
              <div className={`pads ${isHarmonyLayer(layer) ? "h4" : "b16"}`}>
                {layer.steps.map((step, i) => {
                  const empty = step === "~" || step === "-";
                  return (
                    <button
                      key={`${layer.id}-${i}`}
                      type="button"
                      className={`pad ${empty ? "empty" : "hit"} ${layer.kind}`}
                      onClick={() => cycleStep(i)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        clearStep(i);
                      }}
                    >
                      <span className="pad-i">{i + 1}</span>
                      <span className="pad-v">{empty ? "·" : step}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {lens === "sound" && (
              <div className="sound-grid">
                {sounds.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`snd ${layer.sound === s ? "on" : ""}`}
                    onClick={() => patchLayer(layer.id, { sound: s })}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  className={`snd mute ${layer.muted ? "on" : ""}`}
                  onClick={() => patchLayer(layer.id, { muted: !layer.muted })}
                >
                  {layer.muted ? "뮤트 해제" : "뮤트"}
                </button>
                {sheet.layers.length > 1 && (
                  <button type="button" className="snd danger" onClick={() => removeLayer(layer.id)}>
                    레이어 삭제
                  </button>
                )}
              </div>
            )}

            {lens === "fx" && (
              <div className="fx">
                <label className="slider">
                  <span>게인</span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.01}
                    value={layer.gain}
                    onChange={(e) => patchLayer(layer.id, { gain: Number(e.target.value) })}
                  />
                  <em>{layer.gain.toFixed(2)}</em>
                </label>
                <label className="slider">
                  <span>{isHarmonyLayer(layer) ? "컷오프" : "룸"}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={layer.spice}
                    onChange={(e) => patchLayer(layer.id, { spice: Number(e.target.value) })}
                  />
                  <em>{layer.spice.toFixed(2)}</em>
                </label>
                <label className="slider">
                  <span>템포</span>
                  <input
                    type="range"
                    min={60}
                    max={160}
                    step={1}
                    value={sheet.bpm}
                    onChange={(e) =>
                      updateSheet((prev) => ({ ...prev, bpm: Number(e.target.value) }))
                    }
                  />
                  <em>{sheet.bpm}</em>
                </label>
              </div>
            )}
          </section>
        </>
      )}

      <footer className="foot">
        <p className="status">{status}</p>
        <p className="hint">
          {lens === "steps"
            ? "탭=사이클 · 길게/우클릭=비우기"
            : lens === "sound"
              ? "레이어 칩 길게=삭제"
              : "재생 중에도 바로 반영"}
        </p>
      </footer>
    </div>
  );
}
