/**
 * Studio session — 여러 SheetDoc 슬롯 + 체인 재생.
 * URL 키 `u` (심플 `s` 와 분리).
 */

import { createInitialSheet, type SheetState } from "./sheet";
import { decodeSheetParam, encodeSheetParam } from "./sheetDoc";
import { normalizeSheet } from "./persist";

export const STUDIO_SLOT_COUNT = 8;
export const STUDIO_QUERY_KEY = "u";

export type StudioState = {
  /** 고정 8슬롯. null = 빈 칸 */
  slots: Array<SheetState | null>;
  /** 편집 중인 슬롯 */
  active: number;
  /** 채운 슬롯을 순서대로 cat 재생 */
  chain: boolean;
};

export function createEmptyStudio(): StudioState {
  return {
    slots: Array.from({ length: STUDIO_SLOT_COUNT }, () => null),
    active: 0,
    chain: false,
  };
}

/** 슬롯0에 빈 시트 하나 넣은 시작 상태 */
export function createDefaultStudio(): StudioState {
  const studio = createEmptyStudio();
  studio.slots[0] = createInitialSheet();
  return studio;
}

export function clampActive(active: number): number {
  if (!Number.isFinite(active)) return 0;
  return Math.max(0, Math.min(STUDIO_SLOT_COUNT - 1, Math.round(active)));
}

export function filledOrder(slots: Array<SheetState | null>): number[] {
  const order: number[] = [];
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i]) order.push(i);
  }
  return order;
}

export function sheetsForChain(studio: StudioState): SheetState[] {
  return filledOrder(studio.slots).map((i) => studio.slots[i]!);
}

export function activeSheet(studio: StudioState): SheetState {
  return studio.slots[studio.active] ?? createInitialSheet();
}

export function ensureActiveSheet(studio: StudioState): StudioState {
  const active = clampActive(studio.active);
  const slots = [...studio.slots];
  if (!slots[active]) {
    slots[active] = createInitialSheet();
  }
  return { ...studio, active, slots };
}

export function setActiveSlot(studio: StudioState, index: number): StudioState {
  const active = clampActive(index);
  const slots = [...studio.slots];
  if (!slots[active]) slots[active] = createInitialSheet();
  return { ...studio, active, slots };
}

export function clearSlot(studio: StudioState, index: number): StudioState {
  const i = clampActive(index);
  const slots = [...studio.slots];
  slots[i] = null;
  let active = studio.active;
  if (active === i) {
    const next = filledOrder(slots)[0];
    active = next ?? i;
    if (!slots[active]) slots[active] = createInitialSheet();
  }
  return { ...studio, slots, active };
}

export function updateActiveSheet(
  studio: StudioState,
  sheet: SheetState,
): StudioState {
  const active = clampActive(studio.active);
  const slots = [...studio.slots];
  slots[active] = sheet;
  return { ...studio, active, slots };
}

type StudioWireV1 = {
  v: 1;
  a: number;
  c: 0 | 1;
  /** encodeSheetParam or null */
  s: Array<string | null>;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

export function encodeStudioParam(studio: StudioState): string {
  const wire: StudioWireV1 = {
    v: 1,
    a: clampActive(studio.active),
    c: studio.chain ? 1 : 0,
    s: Array.from({ length: STUDIO_SLOT_COUNT }, (_, i) => {
      const sheet = studio.slots[i];
      return sheet ? encodeSheetParam(sheet) : null;
    }),
  };
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(wire)));
}

export function decodeStudioParam(raw: string): StudioState | null {
  const bytes = base64UrlToBytes(raw);
  if (!bytes || bytes.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Partial<StudioWireV1>;
    if (o.v !== 1 || !Array.isArray(o.s)) return null;
    const slots: Array<SheetState | null> = Array.from(
      { length: STUDIO_SLOT_COUNT },
      (_, i) => {
        const cell = o.s![i];
        if (cell == null || cell === "") return null;
        if (typeof cell !== "string") return null;
        const sheet = decodeSheetParam(cell);
        return sheet ? normalizeSheet(sheet) : null;
      },
    );
    if (!slots.some((s) => s != null)) {
      slots[0] = createInitialSheet();
    }
    return {
      slots,
      active: clampActive(typeof o.a === "number" ? o.a : 0),
      chain: o.c === 1,
    };
  } catch {
    return null;
  }
}

export function readStudioFromSearch(search: string): StudioState | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  const raw = params.get(STUDIO_QUERY_KEY);
  if (!raw) return null;
  return decodeStudioParam(raw);
}

export function syncStudioQuery(studio: StudioState): void {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(STUDIO_QUERY_KEY, encodeStudioParam(studio));
    // 심플 키가 남아 있으면 제거
    url.searchParams.delete("s");
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (
      next !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) {
      history.replaceState(history.state, "", next);
    }
  } catch (err) {
    console.warn("studio query sync failed", err);
  }
}
