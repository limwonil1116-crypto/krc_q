import * as React from "react";

export function StepSection({
  step,
  title,
  desc,
  children,
}: {
  step?: string;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        {step ? <div className="text-xs font-bold tracking-widest text-[#F37021]">{step}</div> : null}
        <h2 className="text-lg font-bold text-[#1E293B]">{title}</h2>
        {desc ? <p className="mt-1 text-sm text-neutral-500">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}
