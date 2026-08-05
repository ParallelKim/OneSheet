import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInitialSheet,
  KEY_ROOTS,
  nextHit,
  nextKey,
  QUALITIES,
  ROOTS,
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
type Context = "chart" | "root" | "quality" | "rhythm";

const CONTEXTS: readonly { id: Context; label: string }[] = [
  { id: "chart", label: "진행" },
  { id: "root", label: "근음" },
  { id: "quality", label: "화음" },
  { id: "rhythm", label: "리듬" },
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
  const [context, setContext] = useState<Context>("chart");
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
  const voice = VOICES.find((v) => v.id === sheet.voice) ?? VOICES[0]!;

  const patchSlot = (recipe: (prev: ChordSlot | null) => ChordSlot | null) => {
    update((prev) => {
      const chords = [...prev.chords];
      chords[selected] = recipe(chords[selected] ?? null);
      return { ...prev, chords };
    });
  };

  const pads: Pad[] = (() => {
    if (context === "chart") {
      return Array.from({ length: 16 }, (_, i) => {
        if (i < 4) {
          const chord = sheet.chords[i] ?? null;
          return {
            key: `chart-${i}`,
            label: slotLabel(chord),
            sub: `${i + 1}`,
            state: (selected === i ? "on" : chord ? "idle" : "empty") as Pad["state"],
            onPress: () => {
              setSelected(i);
              setContext("root");
            },
          };
        }
        return {
          key: `chart-x-${i}`,
          label: "",
          state: "dim" as const,
          disabled: true,
        };
      });
    }

    if (context === "root") {
      return Array.from({ length: 16 }, (_, i) => {
        if (i < ROOTS.length) {
          const root = ROOTS[i]!;
          const inKey = keyRoots.includes(root);
          const on = current?.root === root;
          return {
            key: `root-${root}`,
            label: root,
            state: (on ? "on" : inKey ? "idle" : "dim") as Pad["state"],
            onPress: () => {
              patchSlot((prev) => ({
                root,
                quality: prev?.quality ?? "maj",
              }));
            },
          };
        }
        if (i === 15) {
          return {
            key: "root-back",
            label: "←",
            sub: "진행",
            state: "idle" as const,
            onPress: () => setContext("chart"),
          };
        }
        return {
          key: `root-x-${i}`,
          label: "",
          state: "dim" as const,
          disabled: true,
        };
      });
    }

    if (context === "quality") {
      const items: Array<{ id: string; label: string; run: () => void; on: boolean }> = [
        ...QUALITIES.map((q) => ({
          id: q.id,
          label: q.label,
          on: current?.quality === q.id,
          run: () => {
            const quality = q.id as Quality;
            patchSlot((prev) => {
              if (!prev) return { root: "C", quality };
              return { ...prev, quality };
            });
          },
        })),
        {
          id: "rest",
          label: "rest",
          on: current === null,
          run: () => patchSlot(() => null),
        },
      ];

      return Array.from({ length: 16 }, (_, i) => {
        if (i < items.length) {
          const item = items[i]!;
          return {
            key: `qual-${item.id}`,
            label: item.label,
            state: (item.on ? "on" : "idle") as Pad["state"],
            onPress: item.run,
          };
        }
        if (i === 15) {
          return {
            key: "qual-back",
            label: "←",
            sub: "진행",
            state: "idle" as const,
            onPress: () => setContext("chart"),
          };
        }
        return {
          key: `qual-x-${i}`,
          label: "",
          state: "dim" as const,
          disabled: true,
        };
      });
    }

    // rhythm
    return sheet.beats.map((hit, i) => {
      const empty = hit === "~";
      return {
        key: `beat-${i}`,
        label: empty ? "·" : hit,
        sub: `${i + 1}`,
        state: (empty ? "empty" : "hit") as Pad["state"],
        onPress: () => {
          update((prev) => {
            const beats = [...prev.beats];
            beats[i] = nextHit(beats[i]!);
            return { ...prev, beats };
          });
        },
      };
    });
  })();

  const contextHint =
    context === "chart"
      ? `${selected + 1}번 칸 · ${slotLabel(current)}`
      : context === "root"
        ? `${selected + 1}번 근음`
        : context === "quality"
          ? `${selected + 1}번 화음`
          : "16분 리듬";

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
