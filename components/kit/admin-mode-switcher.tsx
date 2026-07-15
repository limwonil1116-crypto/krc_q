"use client";

import { useRouter } from "next/navigation";

const MODES: { value: string; label: string; path: string }[] = [
  { value: "admin", label: "관리자 콘솔", path: "/admin" },
  { value: "contractor", label: "시공사 화면", path: "/contractor" },
  { value: "client", label: "한국농어촌공사 화면", path: "/client" },
];

export function AdminModeSwitcher({ current }: { current: string }) {
  const router = useRouter();
  // 감독(공사감독) 화면도 한국농어촌공사 화면으로 통일 표기
  const value = current === "supervisor" ? "client" : current;
  return (
    <select
      value={value}
      onChange={(e) => {
        const m = MODES.find((x) => x.value === e.target.value);
        if (m) router.push(m.path);
      }}
      className="rounded bg-white/15 px-2 py-1 text-xs text-white outline-none hover:bg-white/25"
      title="보기 모드 전환 (관리자 전용)"
    >
      {MODES.map((m) => (
        <option key={m.value} value={m.value} className="text-black">
          👁 {m.label}
        </option>
      ))}
    </select>
  );
}
