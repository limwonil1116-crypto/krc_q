"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function NavControls({ home }: { home: string }) {
  const router = useRouter();
  const btn = "flex h-8 w-8 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="뒤로가기" className={btn} onClick={() => router.back()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <Link href={home} aria-label="홈" className={btn}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5 12 3l9 6.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      </Link>
      <button type="button" aria-label="앞으로가기" className={btn} onClick={() => router.forward()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
