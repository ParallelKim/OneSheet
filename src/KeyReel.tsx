import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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

const ROLL_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/**
 * 오도미터 릴: 뷰포트에는 항상 한 칸만.
 * ♯ = 새 키가 위에서 내려옴 (스트립 ↓)
 * ♭ = 새 키가 아래에서 올라옴 (스트립 ↑)
 * y 기하는 Motion — CSS transition 제거.
 */
export function KeyReel({ value, dir, gen }: KeyReelProps) {
  const reduce = useReducedMotion();
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

    if (reduce) {
      setPhase({ kind: "idle", key: to });
      return;
    }

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
  }, [value, dir, gen, reduce]);

  const settle = () => {
    setPhase({ kind: "idle", key: shown.current });
  };

  const y = phase.kind === "roll" ? phase.y : 0;
  const moving = phase.kind === "roll" && phase.moving;

  return (
    <span className="key-reel" aria-live="polite">
      <motion.span
        className="key-reel-track"
        initial={false}
        animate={{ y: `calc(${y} * var(--key-reel-h))` }}
        transition={
          moving && !reduce
            ? { duration: 0.28, ease: ROLL_EASE }
            : { duration: 0 }
        }
        onAnimationComplete={() => {
          if (moving) settle();
        }}
      >
        {phase.kind === "idle" ? (
          <span className="key-reel-item">{formatKeyGlyph(phase.key)}</span>
        ) : (
          <>
            <span className="key-reel-item">{formatKeyGlyph(phase.top)}</span>
            <span className="key-reel-item">{formatKeyGlyph(phase.bottom)}</span>
          </>
        )}
      </motion.span>
    </span>
  );
}
