"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function BottomNav({ home }: { home: string }) {
  const router = useRouter();
  const btn =
    "flex h-11 w-16 items-center justify-center rounded-xl bg-neutral-100 text-[#0033A0] hover:bg-neutral-200 active:scale-95 transition";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4 py-2">
        <button type="button" aria-label="뒤로가기" className={btn} onClick={() => router.back()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <Link href={home} aria-label="홈" className={btn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5 12 3l9 6.5" />
            <path d="M5 10v10h14V10" />
          </svg>
        </Link>
        <button type="button" aria-label="앞으로가기" className={btn} onClick={() => router.forward()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
