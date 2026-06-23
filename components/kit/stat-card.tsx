import * as React from "react";

export function StatCard({
  value,
  label,
  accent,
}: {
  value: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
      <div className={accent ? "text-2xl font-bold text-[#F37021]" : "text-2xl font-bold text-[#1E3A5F]"}>
        {value}
      </div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}
