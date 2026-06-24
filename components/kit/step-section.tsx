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
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        {step ? <div className="text-sm font-bold tracking-widest text-[#FE5000]">{step}</div> : null}
        <h2 className="text-xl font-bold text-[#0A2540]">{title}</h2>
        {desc ? <p className="mt-1 text-base text-neutral-500">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}
