import { useLayoutEffect, useRef, useState } from "react";
import { formatKeyGlyph } from "./sheet";

type KeyReelProps = {
  value: string;
  /** +1 = ♯(스트립↑), −1 = ♭(스트립↓) */
  dir: 1 | -1;
  /** nudge마다 증가 */
  gen: number;
};

/**
 * 슬롯/오도미터 릴: 고정 뷰포트 한 칸.
 * 스트립이 한 칸 미끄러져 착지 — 첫 프레임 오표시·종료 스냅 없음.
 */
export function KeyReel({ value, dir, gen }: KeyReelProps) {
  const [a, setA] = useState(value);
  const [b, setB] = useState(value);
  const [y, setY] = useState(0);
  const [moving, setMoving] = useState(false);
  const shown = useRef(value);
  const lastGen = useRef(0);

  useLayoutEffect(() => {
    if (gen === lastGen.current) return;
    lastGen.current = gen;

    const from = shown.current;
    const to = value;
    if (from === to) return;

    if (dir > 0) {
      setA(from);
      setB(to);
      setY(0);
    } else {
      setA(to);
      setB(from);
      setY(-1);
    }
    setMoving(false);
    shown.current = to;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMoving(true);
        setY(dir > 0 ? -1 : 0);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [value, dir, gen]);

  const settle = () => {
    const cur = shown.current;
    setMoving(false);
    setA(cur);
    setB(cur);
    setY(0);
  };

  return (
    <span className="key-reel" aria-live="polite">
      <span
        className={`key-reel-track${moving ? " is-moving" : ""}`}
        style={{ ["--key-y" as string]: String(y) }}
        onTransitionEnd={(e) => {
          if (e.propertyName !== "transform") return;
          settle();
        }}
      >
        <span className="key-reel-item">{formatKeyGlyph(a)}</span>
        <span className="key-reel-item">{formatKeyGlyph(b)}</span>
      </span>
    </span>
  );
}
