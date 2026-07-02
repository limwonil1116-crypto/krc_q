"use client";

import { useEffect, useState } from "react";

type Structure = { id: string; name: string; code: string; parentId: string | null; sortOrder: number };
type Spec = { id: string; fileName: string; mimeType: string };

export default function GuidesPage() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [parent, setParent] = useState<{ id: string; name: string } | null>(null);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/guides")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStructures(d.structures || []);
      })
      .catch(() => {});
  }, []);

  async function pickParent(id: string, name: string) {
    setParent({ id, name });
    setSpecs([]);
    setMsg("");
    loadSpecs(id);
  }

  async function loadSpecs(parentId: string) {
    const r = await fetch(`/api/admin/guides?parentSpecId=${parentId}`);
    const d = await r.json();
    if (d.ok) setSpecs(d.specs || []);
  }

  async function uploadSpec(file: File) {
    if (!parent) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("structureTypeId", parent.id);
      fd.append("assetKind", "spec");
      fd.append("file", file);
      const r = await fetch("/api/admin/guides", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "시방서 업로드 실패");
        return;
      }
      setMsg("시방서 업로드 완료");
      loadSpecs(parent.id);
    } finally {
      setBusy(false);
    }
  }

  async function removeSpec(id: string) {
    if (!confirm("이 시방서를 삭제할까요?")) return;
    const r = await fetch(`/api/admin/guides?assetId=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok || !d.ok) {
      setMsg(d.error || "삭제 실패");
      return;
    }
    setSpecs((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 가이드 · 시방서 관리</h1>
        <p className="text-sm text-neutral-500">
          대분류별로 시방서를 등록해 두면, 작업자가 AI 검측 기록을 작성할 때 해당 시방서를 참고하여 설명 내용을 작성합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        {/* 대분류 목록 */}
        <div className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="mb-1 text-xs font-bold text-neutral-500">대분류 선택</div>
          {structures.length === 0 && <p className="text-sm text-neutral-400">구조물이 없습니다.</p>}
          {structures.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickParent(s.id, s.name)}
              className={
                "w-full rounded-md px-2.5 py-2 text-left text-sm font-semibold " +
                (parent?.id === s.id ? "bg-[#0033A0] text-white" : "text-[#0A2540] hover:bg-neutral-100")
              }
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* 시방서 보관함 */}
        <div className="space-y-3">
          {!parent ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
              왼쪽에서 대분류를 선택하세요.
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-[#0A2540]">{parent.name} · 시방서 ({specs.length})</div>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#0033A0] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#002A80]">
                  {busy ? "업로드 중..." : "＋ 시방서 추가"}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSpec(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {msg && <p className="text-sm text-[#0033A0]">{msg}</p>}
              <p className="text-xs text-neutral-400">
                * PDF/HWP/DOC 등. 이 대분류의 모든 세부항목·단계에 공통 적용됩니다. (촬영 단계 구성은 기존 설정이 그대로 유지됩니다.)
              </p>

              {specs.length === 0 ? (
                <p className="text-sm text-neutral-400">등록된 시방서가 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {specs.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
                    >
                      <span className="truncate">📄 {s.fileName}</span>
                      <button
                        type="button"
                        onClick={() => removeSpec(s.id)}
                        className="ml-2 shrink-0 text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
