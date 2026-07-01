"use client";

import { useEffect, useState } from "react";

type Structure = { id: string; name: string; code: string; parentId: string | null; sortOrder: number };
type Child = { id: string; name: string; sortOrder: number };
type Phase = { code: string; name: string; sortOrder: number; parentGuideText: string; subGuideText: string };
type GuideAsset = { id: string; phaseCode: string | null; assetKind: "reference" | "spec"; fileName: string; mimeType: string };

export default function GuidesPage() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [parent, setParent] = useState<{ id: string; name: string } | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [sub, setSub] = useState<{ id: string; name: string } | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [assets, setAssets] = useState<GuideAsset[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
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

  async function pickParent(id: string, name: string) {
    setParent({ id, name });
    setChildren([]);
    setSub(null);
    setPhases([]);
    setAssets([]);
    setTexts({});
    setMsg("");
    const r = await fetch(`/api/admin/guides?parentId=${id}`);
    const d = await r.json();
    if (d.ok) setChildren(d.children || []);
  }

  async function pickSub(id: string, name: string) {
    setSub({ id, name });
    setPhases([]);
    setAssets([]);
    setTexts({});
    setMsg("");
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/guides?subTypeId=${id}`);
      const d = await r.json();
      if (d.ok) {
        setPhases(d.phases || []);
        setAssets(d.assets || []);
        const t: Record<string, string> = {};
        (d.phases || []).forEach((p: Phase) => (t[p.code] = p.subGuideText || ""));
        setTexts(t);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveText(code: string, phaseName: string) {
    if (!sub) return;
    setSavingCode(code);
    setMsg("");
    try {
      // 1) 관리자가 입력한 텍스트 먼저 저장
      await fetch("/api/admin/guides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subTypeId: sub.id, phaseCode: code, guideText: texts[code] || "" }),
      });
      // 2) 시방서·참고사진을 반영해 AI가 가이드 자동 생성(덮어씀)
      setMsg("AI가 시방서·사진을 반영해 가이드를 생성 중...");
      const g = await fetch("/api/admin/guides/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subTypeId: sub.id, phaseCode: code, phaseName, currentText: texts[code] || "" }),
      });
      const gd = await g.json();
      if (g.ok && gd.ok && gd.guideText) {
        setTexts((prev) => ({ ...prev, [code]: gd.guideText }));
        setMsg(`AI 가이드 생성 완료 (시방서 ${gd.specCount || 0}건·참고사진 ${gd.refCount || 0}장 반영)`);
      } else {
        setMsg(gd.error || "저장은 됐으나 AI 생성 실패 (입력 텍스트는 저장됨)");
      }
    } catch {
      setMsg("처리 중 오류가 발생했습니다.");
    } finally {
      setSavingCode(null);
    }
  }

  async function uploadFile(code: string, kind: "reference" | "spec", file: File) {
    if (!sub) return;
    setBusyUpload(code + kind);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("subTypeId", sub.id);
      fd.append("phaseCode", code);
      fd.append("assetKind", kind);
      fd.append("file", file);
      const r = await fetch("/api/admin/guides", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "업로드 실패");
        return;
      }
      const rr = await fetch(`/api/admin/guides?subTypeId=${sub.id}`);
      const dd = await rr.json();
      if (dd.ok) setAssets(dd.assets || []);
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
    "min-h-[100px] w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";
  const upBtn =
    "inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0033A0] hover:bg-neutral-50";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 가이드 관리</h1>
        <p className="text-sm text-neutral-500">
          대분류 → 세부항목(공종) → 5단계(F1~F5) 순으로 가이드를 작성합니다. 세부항목별로 정밀한 가이드를 작성하면 AI가 더 정확하게 검측 기록을 작성합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_200px_1fr]">
        {/* 대분류 */}
        <div className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="mb-1 text-xs font-bold text-neutral-500">① 대분류</div>
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

        {/* 세부항목 */}
        <div className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="mb-1 text-xs font-bold text-neutral-500">② 세부항목(공종)</div>
          {!parent ? (
            <p className="text-sm text-neutral-400">대분류를 선택하세요.</p>
          ) : children.length === 0 ? (
            <p className="text-sm text-neutral-400">세부항목이 없습니다.</p>
          ) : (
            children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickSub(c.id, c.name)}
                className={
                  "w-full rounded-md px-2.5 py-2 text-left text-sm " +
                  (sub?.id === c.id ? "bg-[#0033A0] text-white font-semibold" : "text-neutral-700 hover:bg-neutral-100")
                }
              >
                {c.name}
              </button>
            ))
          )}
        </div>

        {/* F1~F5 편집 */}
        <div className="space-y-4">
          {!sub ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
              세부항목을 선택하면 단계별 가이드를 작성할 수 있습니다.
            </div>
          ) : loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">불러오는 중...</div>
          ) : phases.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
              단계 정의가 없습니다. (대분류에 F1~F5 단계가 필요)
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-[#0A2540]">
                  {parent?.name} · {sub.name} · 단계별 가이드
                </div>
                {msg && <span className="text-sm text-[#0033A0]">{msg}</span>}
              </div>

              {phases.map((p, i) => {
                const photos = assets.filter((a) => a.phaseCode === p.code && a.assetKind === "reference");
                const specs = assets.filter((a) => a.phaseCode === p.code && a.assetKind === "spec");
                return (
                  <div key={p.code} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
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
                        onClick={() => saveText(p.code, p.name)}
                        disabled={savingCode === p.code}
                        className="rounded-md bg-[#0033A0] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
                      >
                        {savingCode === p.code ? "생성 중..." : "저장 + AI 가이드 생성"}
                      </button>
                    </div>

                    {p.parentGuideText && (
                      <div className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-500">
                        <span className="font-semibold text-neutral-600">대분류 공통 가이드:</span> {p.parentGuideText}
                      </div>
                    )}

                    <textarea
                      className={taCls}
                      value={texts[p.code] || ""}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [p.code]: e.target.value }))}
                      placeholder={`${sub.name}의 이 단계 가이드를 시방서 기준으로 작성하세요.`}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-600">참고사진 ({photos.length})</span>
                          <label className={upBtn}>
                            {busyUpload === p.code + "reference" ? "업로드..." : "＋사진"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={busyUpload !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadFile(p.code, "reference", f);
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

                      <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-600">시방서 ({specs.length})</span>
                          <label className={upBtn}>
                            {busyUpload === p.code + "spec" ? "업로드..." : "＋시방서"}
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt"
                              className="hidden"
                              disabled={busyUpload !== null}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadFile(p.code, "spec", f);
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
