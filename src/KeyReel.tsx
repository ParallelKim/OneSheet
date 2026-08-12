import { useLayoutEffect, useRef, useState } from "react";
import { formatKeyGlyph } from "./sheet";
import "./KeyReel.css";

type KeyReelProps = {
  value: string;
  /** +1 = ♯, −1 = ♭ */
  dir: 1 | -1;
  /** nudge마다 증가 */
  gen: number;
};

type Phase =
  | { kind: "idle"; key: string }
  | {
      kind: "roll";
      /** 위→아래 순서의 두 칸 */
      top: string;
      bottom: string;
      /** 0 = top 칸 표시, -1 = bottom 칸 표시 */
      y: 0 | -1;
      moving: boolean;
    };

/**
 * 오도미터 릴: 뷰포트에는 항상 한 칸만.
 * ♯ = 새 키가 위에서 내려옴 (스트립 ↓)
 * ♭ = 새 키가 아래에서 올라옴 (스트립 ↑)
 */
export function KeyReel({ value, dir, gen }: KeyReelProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle", key: value });
  const shown = useRef(value);
  const lastGen = useRef(0);

  useLayoutEffect(() => {
    if (gen === lastGen.current) return;
    lastGen.current = gen;

    const from = shown.current;
    const to = value;
    if (from === to) return;
    shown.current = to;

    // ♯(+): [to, from] — 시작 y=-1(from) → y=0(to). 스트립이 아래로, 새 키가 위에서 진입
    // ♭(−): [from, to] — 시작 y=0(from) → y=-1(to). 스트립이 위로, 새 키가 아래에서 진입
    const top = dir > 0 ? to : from;
    const bottom = dir > 0 ? from : to;
    const y0: 0 | -1 = dir > 0 ? -1 : 0;
    const y1: 0 | -1 = dir > 0 ? 0 : -1;

    setPhase({ kind: "roll", top, bottom, y: y0, moving: false });

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase({ kind: "roll", top, bottom, y: y1, moving: true });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [value, dir, gen]);

  const settle = () => {
    setPhase({ kind: "idle", key: shown.current });
  };

  if (phase.kind === "idle") {
    return (
      <span className="key-reel" aria-live="polite">
        <span className="key-reel-track" style={{ ["--key-y" as string]: "0" }}>
          <span className="key-reel-item">{formatKeyGlyph(phase.key)}</span>
        </span>
      </span>
    );
  }

  return (
    <span className="key-reel" aria-live="polite">
      <span
        className={`key-reel-track${phase.moving ? " is-moving" : ""}`}
        style={{ ["--key-y" as string]: String(phase.y) }}
        onTransitionEnd={(e) => {
          if (e.propertyName !== "transform") return;
          settle();
        }}
      >
        <span className="key-reel-item">{formatKeyGlyph(phase.top)}</span>
        <span className="key-reel-item">{formatKeyGlyph(phase.bottom)}</span>
      </span>
    </span>
  );
}
