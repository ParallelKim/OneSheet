import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const ARCANA_EASE: [number, number, number, number] = [0.33, 1.15, 0.42, 1];

type ArcanaFaceProps = {
  /** min polarity → 180° */
  reversed: boolean;
  children: ReactNode;
};

/** 아르카나 양극 회전 — 기하는 Motion, 점등 opacity는 CSS. */
export function ArcanaFace({ reversed, children }: ArcanaFaceProps) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="arcana-face"
      initial={false}
      animate={{ rotate: reversed ? 180 : 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.38, ease: ARCANA_EASE }
      }
    >
      {children}
    </motion.span>
  );
}
