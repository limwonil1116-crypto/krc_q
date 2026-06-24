"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// 아이콘 그리드용 선택 카드 (구조물/항목 선택 등) - 크게
export function SelectableCard({
  selected,
  onClick,
  icon,
  label,
}: {
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition",
        selected
          ? "border-[#0033A0] bg-[#0033A0] text-white shadow-md"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-[#0033A0] hover:shadow-sm"
      )}
    >
      <span className="text-4xl leading-none sm:text-5xl">{icon}</span>
      <span className="text-base font-bold leading-tight">{label}</span>
    </button>
  );
}
