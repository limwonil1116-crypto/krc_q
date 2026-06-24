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
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
      <div className={accent ? "text-4xl font-extrabold text-[#FE5000]" : "text-4xl font-extrabold text-[#0033A0]"}>
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-neutral-500">{label}</div>
    </div>
  );
}
