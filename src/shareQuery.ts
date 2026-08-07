/**
 * SheetDoc ↔ URL 쿼리 어댑터 (`?s=`).
 * 키 이름은 `s` 고정 — v1/v2는 페이로드로 구분 (sheetDoc.ts).
 */

import {
  decodeSheetParam,
  encodeSheetParam,
} from "./sheetDoc";
import type { SheetState } from "./sheet";

/** 공유 쿼리 키 */
export const SHARE_QUERY_KEY = "s";

export function readSheetFromSearch(search: string): SheetState | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  const raw = params.get(SHARE_QUERY_KEY);
  if (!raw) return null;
  return decodeSheetParam(raw);
}

export function sheetToShareUrl(
  sheet: SheetState,
  base: string | URL = typeof window !== "undefined"
    ? window.location.href
    : "https://gridplay.web.app/",
): string {
  const url = new URL(base);
  url.searchParams.set(SHARE_QUERY_KEY, encodeSheetParam(sheet));
  return url.toString();
}

/** history.replaceState로 ?s= 동기화 (히스토리 스택 안 쌓음) */
export function syncSheetQuery(sheet: SheetState): void {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_QUERY_KEY, encodeSheetParam(sheet));
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      history.replaceState(history.state, "", next);
    }
  } catch (err) {
    console.warn("share query sync failed", err);
  }
}
