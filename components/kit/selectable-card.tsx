"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// 아이콘 그리드용 선택 카드 (구조물/항목 선택 등)
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
        "flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition",
        selected
          ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-[#1E3A5F]"
      )}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
