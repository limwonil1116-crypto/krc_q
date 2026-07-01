"use client";

import { useEffect, useRef, useState } from "react";

type Node = { id: string; name: string; code: string; parentId: string | null; sortOrder: number };
type TreeNode = Node & { children: Node[] };
type GuideAsset = { id: string; assetKind: "reference" | "spec"; fileName: string; mimeType: string; storageFileId: string | null };

export default function GuidesPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [orphans, setOrphans] = useState<Node[]>([]);
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [guideText, setGuideText] = useState("");
  const [assets, setAssets] = useState<GuideAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [busyUpload, setBusyUpload] = useState<"reference" | "spec" | null>(null);

  const photoInput = useRef<HTMLInputElement | null>(null);
  const specInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/admin/guides")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setTree(d.tree || []);
          setOrphans(d.orphanChildren || []);
        }
      })
      .catch(() => {});
  }, []);

  async function pick(id: string, name: string) {
    setSel({ id, name });
    setGuideText("");
    setAssets([]);
    setMsg("");
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/guides?structureTypeId=${id}`);
      const d = await r.json();
      if (d.ok) {
        setGuideText(d.item?.guideText || "");
        setAssets(d.assets || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveText() {
    if (!sel) return;
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/guides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structureTypeId: sel.id, guideText }),
      });
      const d = await r.json();
      setMsg(!r.ok || !d.ok ? d.error || "저장 실패" : "가이드 저장 완료");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(kind: "reference" | "spec", file: File) {
    if (!sel) return;
    setBusyUpload(kind);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("structureTypeId", sel.id);
      fd.append("assetKind", kind);
      fd.append("file", file);
      const r = await fetch("/api/admin/guides", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "업로드 실패");
        return;
      }
      // 목록 새로고침
      const rr = await fetch(`/api/admin/guides?structureTypeId=${sel.id}`);
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

  const photos = assets.filter((a) => a.assetKind === "reference");
  const specs = assets.filter((a) => a.assetKind === "spec");

  const taCls =
    "min-h-[160px] w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";
  const upBtn =
    "inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-[#0033A0] hover:bg-neutral-50";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 가이드 관리</h1>
        <p className="text-sm text-neutral-500">
          단계별로 가이드/프롬프트를 작성하고 참고사진·시방서를 등록하세요. AI 검측 기록 작성 시 이 가이드를 참고합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* 트리 */}
        <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="text-xs font-bold text-neutral-500">단계 선택</div>
          {tree.length === 0 && orphans.length === 0 && (
            <p className="text-sm text-neutral-400">등록된 구조물이 없습니다.</p>
          )}
          {tree.map((parent) => (
            <div key={parent.id} className="space-y-1">
              <div className="rounded-md bg-neutral-100 px-2 py-1.5 text-sm font-bold text-[#0A2540]">{parent.name}</div>
              {parent.children.length > 0 && (
                <div className="ml-2 space-y-1 border-l border-neutral-200 pl-2">
                  {parent.children.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c.id, c.name)}
                      className={
                        "w-full rounded-md px-2 py-1 text-left text-sm " +
                        (sel?.id === c.id ? "bg-[#0033A0] text-white" : "text-neutral-700 hover:bg-neutral-100")
                      }
                    >
                      └ {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 편집 */}
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
          {!sel ? (
            <p className="text-sm text-neutral-400">왼쪽에서 단계를 선택하세요.</p>
          ) : loading ? (
            <p className="text-sm text-neutral-400">불러오는 중...</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-[#0A2540]">{sel.name}</div>
                <button
                  type="button"
                  onClick={saveText}
                  disabled={saving}
                  className="rounded-md bg-[#0033A0] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "가이드 저장"}
                </button>
              </div>
              {msg && <p className="text-sm text-[#0033A0]">{msg}</p>}

              {/* 가이드 텍스트 */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[#0A2540]">가이드 / 프롬프트 (시방서 기준으로 작성)</label>
                <textarea
                  className={taCls}
                  value={guideText}
                  onChange={(e) => setGuideText(e.target.value)}
                  placeholder={"예) 이 단계에서는 조립식 옹벽의 기초 콘크리트 타설 상태를 검측한다.\n- 확인 항목: 기초 폭/두께(설계 대비), 철근 배근 간격, 다짐 상태\n- 촬영: 스타프로 폭·두께가 보이도록, 전경 1장 + 근접 1장\n- 시방 기준: KCS ... 허용오차 ±..."}
                />
              </div>

              {/* 참고사진 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#0A2540]">참고사진 ({photos.length})</label>
                  <label className={upBtn}>
                    {busyUpload === "reference" ? "업로드 중..." : "＋ 사진 추가"}
                    <input
                      ref={photoInput}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busyUpload !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile("reference", f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((a) => (
                      <div key={a.id} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/admin/guides/raw?assetId=${a.id}`}
                          alt={a.fileName}
                          className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#0A2540]">시방서 파일 ({specs.length})</label>
                  <label className={upBtn}>
                    {busyUpload === "spec" ? "업로드 중..." : "＋ 시방서 추가"}
                    <input
                      ref={specInput}
                      type="file"
                      accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt"
                      className="hidden"
                      disabled={busyUpload !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile("spec", f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {specs.length > 0 && (
                  <ul className="space-y-1">
                    {specs.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm">
                        <span className="truncate">📄 {a.fileName}</span>
                        <button type="button" onClick={() => removeAsset(a.id)} className="ml-2 shrink-0 text-red-600 hover:underline">
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-neutral-400">
                  * 현재는 시방서를 파일로 보관합니다. AI는 위 &lsquo;가이드/프롬프트&rsquo; 텍스트를 사용합니다. (시방서 자동 분석은 다음 단계에서)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
