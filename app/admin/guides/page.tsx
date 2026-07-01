"use client";

import { useEffect, useState } from "react";

type Structure = { id: string; name: string; code: string; parentId: string | null; sortOrder: number };
type Phase = { id: string; code: string; name: string; guideText: string | null; sortOrder: number };
type GuideAsset = { id: string; phaseTemplateId: string | null; assetKind: "reference" | "spec"; fileName: string; mimeType: string };

export default function GuidesPage() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [assets, setAssets] = useState<GuideAsset[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyUpload, setBusyUpload] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/guides")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStructures(d.structures || []);
      })
      .catch(() => {});
  }, []);

  async function pick(id: string, name: string) {
    setSel({ id, name });
    setPhases([]);
    setAssets([]);
    setTexts({});
    setMsg("");
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/guides?structureTypeId=${id}`);
      const d = await r.json();
      if (d.ok) {
        setPhases(d.phases || []);
        setAssets(d.assets || []);
        const t: Record<string, string> = {};
        (d.phases || []).forEach((p: Phase) => (t[p.id] = p.guideText || ""));
        setTexts(t);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveText(phaseId: string) {
    setSavingId(phaseId);
    setMsg("");
    try {
      const r = await fetch("/api/admin/guides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseTemplateId: phaseId, guideText: texts[phaseId] || "" }),
      });
      const d = await r.json();
      setMsg(!r.ok || !d.ok ? d.error || "저장 실패" : "저장 완료");
    } finally {
      setSavingId(null);
    }
  }

  async function uploadFile(phaseId: string, kind: "reference" | "spec", file: File) {
    setBusyUpload(phaseId + kind);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("phaseTemplateId", phaseId);
      fd.append("assetKind", kind);
      fd.append("file", file);
      const r = await fetch("/api/admin/guides", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "업로드 실패");
        return;
      }
      if (sel) {
        const rr = await fetch(`/api/admin/guides?structureTypeId=${sel.id}`);
        const dd = await rr.json();
        if (dd.ok) setAssets(dd.assets || []);
      }
    } finally {
      setBusyUpload(null);
    }
  }

  async function removeAsset(id: string) {
    if (!confirm("이 자료를 삭제할까요?")) return;
    const r = await fetch(`/api/admin/guides?assetId=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok || !d.ok) {
      setMsg(d.error || "삭제 실패");
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  const taCls =
    "min-h-[110px] w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";
  const upBtn =
    "inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0033A0] hover:bg-neutral-50";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 가이드 관리</h1>
        <p className="text-sm text-neutral-500">
          구조물을 선택하면 5단계(F1~F5)별로 가이드/프롬프트와 참고사진·시방서를 등록할 수 있습니다. AI 검측 기록 작성 시 각 단계의 가이드를 참고합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        {/* 구조물 목록 */}
        <div className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="mb-1 text-xs font-bold text-neutral-500">구조물 선택</div>
          {structures.length === 0 && <p className="text-sm text-neutral-400">단계가 등록된 구조물이 없습니다.</p>}
          {structures.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s.id, s.name)}
              className={
                "w-full rounded-md px-2.5 py-2 text-left text-sm font-semibold " +
                (sel?.id === s.id ? "bg-[#0033A0] text-white" : "text-[#0A2540] hover:bg-neutral-100")
              }
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* F1~F5 단계별 편집 */}
        <div className="space-y-4">
          {!sel ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
              왼쪽에서 구조물을 선택하세요.
            </div>
          ) : loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">불러오는 중...</div>
          ) : phases.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
              이 구조물에 단계가 없습니다.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-[#0A2540]">{sel.name} · 단계별 가이드</div>
                {msg && <span className="text-sm text-[#0033A0]">{msg}</span>}
              </div>

              {phases.map((p, i) => {
                const photos = assets.filter((a) => a.phaseTemplateId === p.id && a.assetKind === "reference");
                const specs = assets.filter((a) => a.phaseTemplateId === p.id && a.assetKind === "spec");
                return (
                  <div key={p.id} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0033A0] text-xs font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="text-sm font-bold text-[#0A2540]">{p.name}</span>
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">{p.code}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveText(p.id)}
                        disabled={savingId === p.id}
                        className="rounded-md bg-[#0033A0] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
                      >
                        {savingId === p.id ? "저장 중..." : "저장"}
                      </button>
                    </div>

                    <textarea
                      className={taCls}
                      value={texts[p.id] || ""}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={"이 단계의 가이드/프롬프트를 시방서 기준으로 작성하세요.\n예) 스타프로 폭·두께 측정, 철근 간격 확인, 허용오차 ±..."}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* 참고사진 */}
                      <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-600">참고사진 ({photos.length})</span>
                          <label className={upBtn}>
                            {busyUpload === p.id + "reference" ? "업로드..." : "＋사진"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={busyUpload !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadFile(p.id, "reference", f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {photos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {photos.map((a) => (
                              <div key={a.id} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/admin/guides/raw?assetId=${a.id}`}
                                  alt={a.fileName}
                                  className="h-16 w-16 rounded border border-neutral-200 object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeAsset(a.id)}
                                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 시방서 */}
                      <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-600">시방서 ({specs.length})</span>
                          <label className={upBtn}>
                            {busyUpload === p.id + "spec" ? "업로드..." : "＋시방서"}
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt"
                              className="hidden"
                              disabled={busyUpload !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadFile(p.id, "spec", f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {specs.length > 0 && (
                          <ul className="space-y-1">
                            {specs.map((a) => (
                              <li key={a.id} className="flex items-center justify-between rounded border border-neutral-200 bg-white px-2 py-1 text-xs">
                                <span className="truncate">📄 {a.fileName}</span>
                                <button type="button" onClick={() => removeAsset(a.id)} className="ml-1 shrink-0 text-red-600 hover:underline">
                                  삭제
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-neutral-400">
                * 시방서는 파일로 보관됩니다. AI는 위 단계별 &lsquo;가이드/프롬프트&rsquo; 텍스트를 사용합니다. (시방서 자동 분석은 다음 단계)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
