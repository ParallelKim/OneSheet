import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialSheet,
  DEGREE_META,
  nextKey,
  PRESETS,
  RHYTHM_PRESETS,
  slotLabel,
  slotRoman,
  toggleBeat,
  toStrudel,
  VOICES,
  type SheetState,
  type VoiceId,
} from "./sheet";
import { evaluateStrudel, hushStrudel, initStrudelEngine } from "./engine";
import "./App.css";

type EngineState = "idle" | "ready" | "playing" | "error";
/** 차트는 항상 보임. 그리드 문맥만 렌즈. */
type Context = "degree" | "chordPreset" | "rhythm" | "rhythmPreset";

const CONTEXTS: readonly { id: Context; label: string }[] = [
  { id: "degree", label: "도수" },
  { id: "chordPreset", label: "진행" },
  { id: "rhythm", label: "리듬" },
  { id: "rhythmPreset", label: "그루브" },
];

type Pad = {
  key: string;
  label: string;
  sub?: string;
  state: "idle" | "on" | "dim" | "hit" | "empty";
  disabled?: boolean;
  onPress?: () => void;
};

export default function App() {
  const [sheet, setSheet] = useState<SheetState>(createInitialSheet);
  const [selected, setSelected] = useState(0);
  const [context, setContext] = useState<Context>("degree");
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

  const voice = VOICES.find((v) => v.id === sheet.voice) ?? VOICES[0]!;
  const currentDegree = sheet.degrees[selected] ?? null;

  const toggleDegree = (degree: number) => {
    update((prev) => {
      const degrees = [...prev.degrees];
      degrees[selected] = degrees[selected] === degree ? null : degree;
      return { ...prev, degrees };
    });
  };

  const pads: Pad[] = (() => {
    if (context === "degree") {
      return Array.from({ length: 16 }, (_, i) => {
        if (i < DEGREE_META.length) {
          const meta = DEGREE_META[i]!;
          const used = sheet.degrees.includes(i);
          const on = currentDegree === i;
          return {
            key: `deg-${i}`,
            label: meta.roman,
            sub: slotLabel(sheet.key, i),
            state: (on ? "on" : used ? "hit" : "idle") as Pad["state"],
            onPress: () => toggleDegree(i),
          };
        }
        if (i === 7) {
          return {
            key: "deg-rest",
            label: "rest",
            state: (currentDegree === null ? "on" : "idle") as Pad["state"],
            onPress: () => {
              update((prev) => {
                const degrees = [...prev.degrees];
                degrees[selected] = null;
                return { ...prev, degrees };
              });
            },
          };
        }
        return {
          key: `deg-x-${i}`,
          label: "",
          state: "dim" as const,
          disabled: true,
        };
      });
    }

    if (context === "chordPreset") {
      return Array.from({ length: 16 }, (_, i) => {
        if (i < PRESETS.length) {
          const preset = PRESETS[i]!;
          const active =
            preset.degrees.length === sheet.degrees.length &&
            preset.degrees.every((d, idx) => d === sheet.degrees[idx]);
          return {
            key: `pre-${preset.id}`,
            label: preset.name,
            sub: preset.label,
            state: (active ? "on" : "idle") as Pad["state"],
            onPress: () => {
              update((prev) => ({ ...prev, degrees: [...preset.degrees] }));
              setSelected(0);
            },
          };
        }
        return {
          key: `pre-x-${i}`,
          label: "",
          state: "dim" as const,
          disabled: true,
        };
      });
    }

    if (context === "rhythmPreset") {
      return Array.from({ length: 16 }, (_, i) => {
        if (i < RHYTHM_PRESETS.length) {
          const preset = RHYTHM_PRESETS[i]!;
          const active = preset.beats.every((b, idx) => b === sheet.beats[idx]);
          return {
            key: `rpre-${preset.id}`,
            label: preset.name,
            state: (active ? "on" : "idle") as Pad["state"],
            onPress: () => {
              update((prev) => ({ ...prev, beats: [...preset.beats] }));
              setContext("rhythm");
            },
          };
        }
        return {
          key: `rpre-x-${i}`,
          label: "",
          state: "dim" as const,
          disabled: true,
        };
      });
    }

    // rhythm: 존재 토글 (샘플명 사이클 아님)
    return sheet.beats.map((hit, i) => {
      const empty = hit === "~";
      return {
        key: `beat-${i}`,
        label: empty ? "·" : "●",
        sub: `${i + 1}`,
        state: (empty ? "empty" : "hit") as Pad["state"],
        onPress: () => {
          update((prev) => ({ ...prev, beats: toggleBeat(prev.beats, i) }));
        },
      };
    });
  })();

  const contextHint =
    context === "degree"
      ? `${selected + 1}번 칸 · ${sheet.key} 다이아토닉`
      : context === "chordPreset"
        ? "진행 프리셋"
        : context === "rhythm"
          ? "스텝 on/off"
          : "리듬 프리셋";

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

      <section className="chart" aria-label="차트">
        {sheet.degrees.map((degree, i) => (
          <button
            key={i}
            type="button"
            className={`chart-slot ${selected === i ? "on" : ""} ${degree === null ? "empty" : ""}`}
            onClick={() => {
              setSelected(i);
              setContext("degree");
            }}
          >
            <span className="chart-roman">{slotRoman(degree)}</span>
            <span className="chart-chord">{slotLabel(sheet.key, degree)}</span>
          </button>
        ))}
      </section>

      <nav className="contexts" aria-label="문맥">
        {CONTEXTS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ctx ${context === c.id ? "on" : ""}`}
            onClick={() => setContext(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>

      <p className="context-hint">{contextHint}</p>

      <section className="pad-grid" aria-label="패드">
        {pads.map((pad) => (
          <button
            key={pad.key}
            type="button"
            className={`pad ${pad.state}`}
            disabled={pad.disabled}
            onClick={() => pad.onPress?.()}
          >
            {pad.sub ? <span className="pad-sub">{pad.sub}</span> : null}
            <span className="pad-label">{pad.label}</span>
          </button>
        ))}
      </section>

      <footer className="foot">
        <p className="status">{status}</p>
      </footer>
    </div>
  );
}
