/**
 * Portable sheet document — URL / 파일 / 서버 공통 포맷.
 *
 * 인터페이스는 이 문서를 기준으로 연다:
 * - 쿼리 `?s=` (base64url JSON) ← 우선
 * - 이후: 세이브 파일, 서버 등
 *
 * Wire v1 (JSON):
 * {
 *   v: 1,
 *   bpm, key, metro, mode, gain?,
 *   deg: number[16],   // -1 = 빈 슬롯
 *   ton: string[16],   // "" | "1.b3.5"
 *   rhy: string,       // 16자 D|U|X|h|r
 *   ov: (string|null)[3]  // bar1..3 override (null=상속)
 * }
 */

import {
  BARS,
  BAR_STEPS,
  CHORD_INTERVALS,
  createInitialSheet,
  SLOTS,
  type Articulation,
  type ChordInterval,
  type SheetState,
  type SoundModeId,
  type ToneSet,
} from "./sheet";
import { normalizeSheet } from "./persist";

export const SHEET_DOC_VERSION = 1 as const;

export type SheetDocV1 = {
  v: typeof SHEET_DOC_VERSION;
  bpm: number;
  key: string;
  metro: boolean;
  mode: SoundModeId;
  gain?: number;
  deg: number[];
  ton: string[];
  rhy: string;
  ov: Array<string | null>;
};

export type SheetDoc = SheetDocV1;

const ART_CHAR: Record<Articulation, string> = {
  D: "D",
  U: "U",
  X: "X",
  hold: "h",
  rest: "r",
};

const CHAR_ART: Record<string, Articulation> = {
  D: "D",
  U: "U",
  X: "X",
  h: "hold",
  r: "rest",
  "~": "hold",
  ".": "rest",
};

function packTones(tones: ToneSet | null): string {
  if (!tones || tones.length === 0) return "";
  return CHORD_INTERVALS.filter((id) => tones.includes(id)).join(".");
}

function unpackTones(raw: string): ChordInterval[] | null {
  if (!raw) return null;
  const parts = raw.split(".").filter(Boolean);
  const tones = CHORD_INTERVALS.filter((id) => parts.includes(id));
  return tones.length > 0 ? [...tones] : null;
}

function packArts(arts: Articulation[]): string {
  return Array.from({ length: BAR_STEPS }, (_, i) => ART_CHAR[arts[i] ?? "rest"]).join(
    "",
  );
}

function unpackArts(raw: string): Articulation[] {
  return Array.from({ length: BAR_STEPS }, (_, i) => CHAR_ART[raw[i] ?? "r"] ?? "rest");
}

/** SheetState → 휴대용 문서 */
export function sheetToDoc(sheet: SheetState): SheetDocV1 {
  const deg = Array.from({ length: SLOTS }, (_, i) => {
    const d = sheet.degrees[i];
    return d === null || d === undefined ? -1 : d;
  });
  const ton = Array.from({ length: SLOTS }, (_, i) =>
    deg[i] === -1 ? "" : packTones(sheet.tones[i] ?? null),
  );
  const ov = Array.from({ length: BARS - 1 }, (_, i) => {
    const row = sheet.rhythmOverride[i + 1];
    return row ? packArts(row) : null;
  });
  return {
    v: SHEET_DOC_VERSION,
    bpm: sheet.bpm,
    key: sheet.key,
    metro: sheet.metro,
    mode: sheet.soundMode,
    gain: sheet.gain,
    deg,
    ton,
    rhy: packArts(sheet.rhythm),
    ov,
  };
}

/** 휴대용 문서 → SheetState (normalize로 검증) */
export function docToSheet(doc: unknown): SheetState {
  if (!doc || typeof doc !== "object") return createInitialSheet();
  const o = doc as Record<string, unknown>;
  if (o.v !== 1) return createInitialSheet();

  const degIn = Array.isArray(o.deg) ? o.deg : [];
  const tonIn = Array.isArray(o.ton) ? o.ton : [];
  const degrees = Array.from({ length: SLOTS }, (_, i) => {
    const n = degIn[i];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return null;
    return n;
  });
  const tones = Array.from({ length: SLOTS }, (_, i) => {
    if (degrees[i] === null) return null;
    const packed = typeof tonIn[i] === "string" ? tonIn[i] : "";
    return unpackTones(packed);
  });

  const rhy = typeof o.rhy === "string" ? o.rhy : "";
  const rhythm = unpackArts(rhy);
  const ovIn = Array.isArray(o.ov) ? o.ov : [];
  const rhythmOverride = Array.from({ length: BARS }, (_, bar) => {
    if (bar === 0) return null;
    const cell = ovIn[bar - 1];
    if (cell == null || typeof cell !== "string") return null;
    return unpackArts(cell);
  });

  return normalizeSheet({
    bpm: o.bpm,
    key: o.key,
    metro: o.metro,
    soundMode: o.mode,
    gain: o.gain,
    degrees,
    tones,
    rhythm,
    rhythmOverride,
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(raw: string): Uint8Array | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin =
      typeof atob === "function"
        ? atob(b64 + pad)
        : Buffer.from(b64 + pad, "base64").toString("binary");
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** 문서 → 쿼리/파일용 문자열 */
export function encodeSheetDoc(doc: SheetDoc): string {
  const json = JSON.stringify(doc);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeSheetDoc(raw: string): SheetDoc | null {
  const bytes = base64UrlToBytes(raw);
  if (!bytes) return null;
  try {
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if ((parsed as SheetDoc).v !== 1) return null;
    return parsed as SheetDoc;
  } catch {
    return null;
  }
}

export function encodeSheetParam(sheet: SheetState): string {
  return encodeSheetDoc(sheetToDoc(sheet));
}

export function decodeSheetParam(raw: string): SheetState | null {
  const doc = decodeSheetDoc(raw);
  if (!doc) return null;
  return docToSheet(doc);
}
