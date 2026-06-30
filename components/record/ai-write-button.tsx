"use client";

import { useState } from "react";

type Result = { text: string; measurements: string[]; notes: string[] };

export function AiWriteButton({
  assetIds,
  phaseName,
  structureTypeName,
  subTypeName,
  guideText,
  currentText,
  onApply,
}: {
  assetIds: string[];
  phaseName: string;
  structureTypeName: string;
  subTypeName?: string;
  guideText?: string;
  currentText: string;
  onApply: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds,
          phaseName,
          structureTypeName,
          subTypeName: subTypeName || "",
          guideText: guideText || "",
          userMemo: currentText || "",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setErr(d.error || `요청 실패 (${res.status})`);
        return;
      }
      setResult(d.result as Result);
    } catch (e) {
      setErr("오류: " + (e instanceof Error ? e.message : "네트워크"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy || assetIds.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0033A0] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
        >
          {busy ? "분석 중..." : "🤖 AI 검측 기록 작성"}
        </button>
        <span className="text-xs text-neutral-500">
          {assetIds.length === 0 ? "사진을 먼저 추가하세요" : "사진을 분석해 기록 초안을 만듭니다"}
        </span>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {result && (
        <div className="space-y-2 rounded-xl border border-[#0033A0]/20 bg-[#F5F8FF] p-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              ⚠ AI 초안 · 확인 후 수정하세요
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-[#0A2540]">{result.text}</p>

          {result.measurements?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.measurements.map((m, i) => (
                <span key={i} className="rounded-full bg-[#EAF0FB] px-2.5 py-1 text-xs font-semibold text-[#0033A0]">
                  📏 {m}
                </span>
              ))}
            </div>
          )}

          {result.notes?.length > 0 && (
            <ul className="list-inside list-disc text-xs text-neutral-600">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onApply(result.text)}
              className="rounded-md bg-[#FE5000] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#E04800]"
            >
              설명내용에 적용
            </button>
            <button
              type="button"
              onClick={() => onApply(currentText ? currentText + "\n" + result.text : result.text)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-50"
            >
              기존 뒤에 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
