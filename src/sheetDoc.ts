/**
 * Portable sheet document — URL / 파일 / 서버 공통 포맷.
 *
 * 쿼리 키는 `?s=` 고정. 버전은 페이로드로 구분한다.
 * - v2 (쓰기 기본): 바이너리 비트팩 → base64url (첫 바이트 = 2)
 * - v1 (읽기 호환): base64url(JSON) — 옛 공유 링크
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
 *
 * Wire v2 (binary):
 *   [0]     u8  version = 2
 *   [1]     u8  bpm - 70          (0..70 → 70..140)
 *   [2]     u8  key:4 | metro:1 | mode:3
 *   [3]     u8  gain×100 (5..100)
 *   [4..11] deg 16×4bit (15=empty)
 *   [12..]  ton 16×12bit 마스크 (CHORD_INTERVALS 비트)
 *           rhy 16×3bit (D/U/X/h/r)
 *           ovMask:3 + 각 override마다 rhy 16×3bit
 */

import {
  BARS,
  BAR_STEPS,
  CHORD_INTERVALS,
  createInitialSheet,
  KEY_CHROMATIC,
  SLOTS,
  SOUND_MODES,
  type Articulation,
  type ChordInterval,
  type SheetState,
  type SoundModeId,
  type ToneSet,
} from "./sheet";
import { normalizeSheet } from "./persist";

export const SHEET_DOC_VERSION = 1 as const;
export const SHEET_DOC_VERSION_V2 = 2 as const;

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

const ART_CODE: Record<Articulation, number> = {
  D: 0,
  U: 1,
  X: 2,
  hold: 3,
  rest: 4,
};

const CODE_ART: Articulation[] = ["D", "U", "X", "hold", "rest"];

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

function toneMask(tones: ToneSet | null | undefined): number {
  if (!tones || tones.length === 0) return 0;
  let mask = 0;
  for (let i = 0; i < CHORD_INTERVALS.length; i += 1) {
    if (tones.includes(CHORD_INTERVALS[i]!)) mask |= 1 << i;
  }
  return mask & 0xfff;
}

function tonesFromMask(mask: number): ChordInterval[] | null {
  const tones = CHORD_INTERVALS.filter((_, i) => (mask & (1 << i)) !== 0);
  return tones.length > 0 ? [...tones] : null;
}

/** MSB-first bit packer */
class BitBuf {
  private bits: number[] = [];

  write(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i -= 1) {
      this.bits.push((value >> i) & 1);
    }
  }

  finish(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i += 1) {
      if (this.bits[i]) out[i >> 3]! |= 1 << (7 - (i & 7));
    }
    return out;
  }

  static from(bytes: Uint8Array, offset = 0): { read: (w: number) => number; pos: () => number } {
    let bit = offset * 8;
    const total = bytes.length * 8;
    return {
      pos: () => Math.ceil(bit / 8),
      read(width: number) {
        let v = 0;
        for (let i = 0; i < width; i += 1) {
          v <<= 1;
          if (bit < total) {
            const b = bytes[bit >> 3]!;
            if (b & (1 << (7 - (bit & 7)))) v |= 1;
            bit += 1;
          }
        }
        return v;
      },
    };
  }
}

function writeArtsBits(arts: Articulation[]): Uint8Array {
  const buf = new BitBuf();
  for (let i = 0; i < BAR_STEPS; i += 1) {
    buf.write(ART_CODE[arts[i] ?? "rest"] ?? 4, 3);
  }
  return buf.finish();
}

function readArtsBits(bytes: Uint8Array, byteOffset: number): Articulation[] {
  const r = BitBuf.from(bytes, byteOffset);
  return Array.from({ length: BAR_STEPS }, () => {
    const c = r.read(3);
    return CODE_ART[c] ?? "rest";
  });
}

/** SheetState → 휴대용 문서 (v1 JSON 모델, 디버그·레거시) */
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

/** 휴대용 문서(v1) → SheetState */
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

/** SheetState → v2 바이너리 */
export function encodeSheetV2(sheet: SheetState): Uint8Array {
  const bpmOff = Math.min(70, Math.max(0, Math.round(sheet.bpm) - 70));
  let keyIdx = KEY_CHROMATIC.indexOf(sheet.key as (typeof KEY_CHROMATIC)[number]);
  if (keyIdx < 0) keyIdx = 0;
  let modeIdx = SOUND_MODES.findIndex((m) => m.id === sheet.soundMode);
  if (modeIdx < 0) modeIdx = 0;
  const metro = sheet.metro ? 1 : 0;
  const gainCent = Math.min(100, Math.max(5, Math.round(sheet.gain * 100)));

  const head = new Uint8Array(4);
  head[0] = SHEET_DOC_VERSION_V2;
  head[1] = bpmOff;
  head[2] = (keyIdx & 0xf) | (metro << 4) | ((modeIdx & 0x7) << 5);
  head[3] = gainCent;

  const deg = new Uint8Array(SLOTS / 2);
  for (let i = 0; i < SLOTS; i += 2) {
    const a = sheet.degrees[i];
    const b = sheet.degrees[i + 1];
    const na = a === null || a === undefined ? 15 : a & 0xf;
    const nb = b === null || b === undefined ? 15 : b & 0xf;
    deg[i / 2] = (na << 4) | nb;
  }

  const tonBuf = new BitBuf();
  for (let i = 0; i < SLOTS; i += 1) {
    tonBuf.write(toneMask(sheet.tones[i]), 12);
  }
  const ton = tonBuf.finish();

  const rhy = writeArtsBits(sheet.rhythm);

  let ovMask = 0;
  const ovParts: Uint8Array[] = [];
  for (let bar = 1; bar < BARS; bar += 1) {
    const row = sheet.rhythmOverride[bar];
    if (row) {
      ovMask |= 1 << (bar - 1);
      ovParts.push(writeArtsBits(row));
    }
  }
  const ovHead = new Uint8Array([ovMask & 0x7]);

  const total =
    head.length +
    deg.length +
    ton.length +
    rhy.length +
    ovHead.length +
    ovParts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  out.set(head, o);
  o += head.length;
  out.set(deg, o);
  o += deg.length;
  out.set(ton, o);
  o += ton.length;
  out.set(rhy, o);
  o += rhy.length;
  out.set(ovHead, o);
  o += ovHead.length;
  for (const part of ovParts) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

/** v2 바이너리 → SheetState */
export function decodeSheetV2(bytes: Uint8Array): SheetState | null {
  if (bytes.length < 4 + 8 + 24 + 6 + 1) return null;
  if (bytes[0] !== SHEET_DOC_VERSION_V2) return null;

  const bpm = 70 + (bytes[1] ?? 0);
  const flags = bytes[2] ?? 0;
  const keyIdx = flags & 0xf;
  const metro = ((flags >> 4) & 1) === 1;
  const modeIdx = (flags >> 5) & 0x7;
  const gain = (bytes[3] ?? 55) / 100;
  const key = KEY_CHROMATIC[keyIdx] ?? "C";
  const mode = (SOUND_MODES[modeIdx]?.id ?? "strum") as SoundModeId;

  let o = 4;
  const degrees: Array<number | null> = [];
  for (let i = 0; i < SLOTS / 2; i += 1) {
    const b = bytes[o + i] ?? 0xff;
    const na = (b >> 4) & 0xf;
    const nb = b & 0xf;
    degrees.push(na === 15 ? null : na);
    degrees.push(nb === 15 ? null : nb);
  }
  o += SLOTS / 2;

  const tonReader = BitBuf.from(bytes, o);
  const tones: Array<ToneSet | null> = [];
  for (let i = 0; i < SLOTS; i += 1) {
    const mask = tonReader.read(12);
    if (degrees[i] === null) {
      tones.push(null);
    } else {
      tones.push(tonesFromMask(mask));
    }
  }
  o += 24;

  const rhythm = readArtsBits(bytes, o);
  o += 6;

  if (o >= bytes.length) return null;
  const ovMask = (bytes[o] ?? 0) & 0x7;
  o += 1;

  const rhythmOverride: Array<Articulation[] | null> = Array.from(
    { length: BARS },
    () => null,
  );
  for (let bar = 1; bar < BARS; bar += 1) {
    if (ovMask & (1 << (bar - 1))) {
      if (o + 6 > bytes.length) return null;
      rhythmOverride[bar] = readArtsBits(bytes, o);
      o += 6;
    }
  }

  return normalizeSheet({
    bpm,
    key,
    metro,
    soundMode: mode,
    gain,
    degrees,
    tones,
    rhythm,
    rhythmOverride,
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(raw: string): Uint8Array | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** v1 JSON 문서 → 쿼리 문자열 (레거시·테스트용) */
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

/** 쓰기: 항상 v2 */
export function encodeSheetParam(sheet: SheetState): string {
  return bytesToBase64Url(encodeSheetV2(sheet));
}

/** 읽기: v2 바이너리 또는 v1 JSON */
export function decodeSheetParam(raw: string): SheetState | null {
  const bytes = base64UrlToBytes(raw);
  if (!bytes || bytes.length === 0) return null;

  if (bytes[0] === SHEET_DOC_VERSION_V2) {
    return decodeSheetV2(bytes);
  }

  const doc = decodeSheetDoc(raw);
  if (!doc) return null;
  return docToSheet(doc);
}
