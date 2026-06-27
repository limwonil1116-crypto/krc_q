"use client";

import { useState } from "react";

type Checkpoint = { title: string; detail: string };
type Result = { labels: string[]; checkpoints: Checkpoint[]; summary: string };

export function InspectHelper({
  assetIds,
  phaseName,
  structureTypeName,
  text,
  compact,
}: {
  assetIds: string[];
  phaseName: string;
  structureTypeName: string;
  text: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  async function run() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds, phaseName, structureTypeName, text }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setErr(d.error || `요청 실패 (${res.status})`);
        return;
      }
      setResult(d.result as Result);
      setOpen(true);
    } catch (e) {
      setErr("오류: " + (e instanceof Error ? e.message : "네트워크"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-[#0033A0]/20 bg-[#F5F8FF] p-3"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0033A0] px-3 py-2 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
        >
          {busy ? "분석 중..." : "🤖 검측 도우미"}
        </button>
        <span className="text-xs text-neutral-500">AI가 사진·내용을 보고 점검 포인트를 제안</span>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {result && open && (
        <div className="mt-3 space-y-3 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="flex items-start justify-between">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              ⚠ AI 참고용 · 최종 판단은 검측자
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
              닫기
            </button>
          </div>

          {result.summary && <p className="text-sm font-semibold text-[#0A2540]">{result.summary}</p>}

          {result.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.labels.map((l, i) => (
                <span key={i} className="rounded-full bg-[#EAF0FB] px-2.5 py-1 text-xs font-semibold text-[#0033A0]">
                  {l}
                </span>
              ))}
            </div>
          )}

          {result.checkpoints?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-500">점검 포인트</div>
              {result.checkpoints.map((c, i) => (
                <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0033A0] text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[#0A2540]">{c.title}</div>
                      <div className="text-xs text-neutral-600">{c.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
