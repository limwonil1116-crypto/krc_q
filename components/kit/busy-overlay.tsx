"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Ctx = { show: () => void; hide: () => void; run: <T>(fn: () => Promise<T>) => Promise<T> };
const BusyCtx = createContext<Ctx | null>(null);

export function useBusy(): Ctx {
  const c = useContext(BusyCtx);
  if (c) return c;
  return { show: () => {}, hide: () => {}, run: async (fn) => fn() };
}

export function BusyProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0); // 수동 run()
  const [navBusy, setNavBusy] = useState(false); // 페이지 이동
  const [fetchBusy, setFetchBusy] = useState(false); // 네트워크 요청

  const show = useCallback(() => setCount((c) => c + 1), []);
  const hide = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setCount((c) => c + 1);
    try {
      return await fn();
    } finally {
      setCount((c) => Math.max(0, c - 1));
    }
  }, []);

  // 주소 변경이 끝나면 네비게이션 로딩 해제
  const pathname = usePathname();
  const search = useSearchParams();
  const lastKey = useRef("");
  useEffect(() => {
    const key = pathname + "?" + (search?.toString() ?? "");
    if (lastKey.current && lastKey.current !== key) setNavBusy(false);
    lastKey.current = key;
  }, [pathname, search]);

  // 내부 링크 클릭 시 이동 로딩 표시
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = (e.target as HTMLElement)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!t) return;
      const href = t.getAttribute("href") || "";
      if (
        t.target === "_blank" ||
        t.hasAttribute("download") ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("/api/")
      ) {
        return;
      }
      setNavBusy(true);
      window.setTimeout(() => setNavBusy(false), 8000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 모든 fetch 요청 중 표시 (250ms 이상 걸릴 때만)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = window.fetch;
    let pending = 0;
    let timer: number | null = null;
    let shown = false;
    const patched: typeof window.fetch = (...args) => {
      // x-silent 헤더 요청(자동저장 등)은 전역 로딩 오버레이를 띄우지 않음
      const _init = args[1] as RequestInit | undefined;
      const _h = (_init?.headers || {}) as Record<string, string>;
      if (_h["x-silent"] === "1" || _h["X-Silent"] === "1") return orig(...args);
      // Next.js 라우터 갱신(RSC) 요청은 오버레이 대상에서 제외
      const _u = typeof args[0] === "string" ? args[0] : ((args[0] as Request)?.url || "");
      if (_u.includes("_rsc=")) return orig(...args);
      pending += 1;
      if (timer === null && !shown) {
        timer = window.setTimeout(() => {
          if (pending > 0) {
            shown = true;
            setFetchBusy(true);
          }
          timer = null;
        }, 250);
      }
      const p = orig(...args);
      const settle = () => {
        pending = Math.max(0, pending - 1);
        if (pending === 0) {
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
          if (shown) {
            shown = false;
            setFetchBusy(false);
          }
        }
      };
      p.then(settle, settle);
      return p;
    };
    window.fetch = patched;
    return () => {
      window.fetch = orig;
    };
  }, []);

  const visible = count > 0 || navBusy || fetchBusy;

  return (
    <BusyCtx.Provider value={{ show, hide, run }}>
      {children}
      {visible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-xl">
            <div className="text-4xl motion-safe:animate-pulse">⏳</div>
            <div className="text-base font-bold text-[#0033A0]">처리 중입니다…</div>
            <div className="text-xs text-neutral-500">잠시만 기다려 주세요</div>
          </div>
        </div>
      )}
    </BusyCtx.Provider>
  );
}
