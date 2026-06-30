"use client";

import { useEffect, useState } from "react";

type Node = { id: string; name: string; code: string; parentId: string | null; sortOrder: number };
type TreeNode = Node & { children: Node[] };
type Phase = { id: string; code: string; name: string; guideText: string | null; sortOrder: number };

export default function GuidesPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [orphans, setOrphans] = useState<Node[]>([]);
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
    setPhases([]);
    setEdited({});
    setMsg("");
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/guides?structureTypeId=${id}`);
      const d = await r.json();
      if (d.ok) setPhases(d.phases || []);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!sel) return;
    const items = phases
      .filter((p) => edited[p.id] !== undefined)
      .map((p) => ({ phaseTemplateId: p.id, guideText: edited[p.id] }));
    if (items.length === 0) {
      setMsg("변경된 내용이 없습니다.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/guides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "저장 실패");
        return;
      }
      setMsg(`${d.count}개 단계 가이드 저장 완료`);
      setPhases((prev) => prev.map((p) => (edited[p.id] !== undefined ? { ...p, guideText: edited[p.id] } : p)));
      setEdited({});
    } finally {
      setSaving(false);
    }
  }

  const taCls =
    "min-h-[90px] w-full rounded-md border border-neutral-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 가이드 관리</h1>
        <p className="text-sm text-neutral-500">
          구조물(세부유형)별 단계마다 촬영·검측 가이드를 작성하세요. AI 검측 기록 작성 시 이 가이드를 참고합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* 구조물 트리 */}
        <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="text-xs font-bold text-neutral-500">구조물 선택</div>
          {tree.length === 0 && orphans.length === 0 && (
            <p className="text-sm text-neutral-400">등록된 구조물 종류가 없습니다.</p>
          )}
          {tree.map((parent) => (
            <div key={parent.id} className="space-y-1">
              <button
                type="button"
                onClick={() => pick(parent.id, parent.name)}
                className={
                  "w-full rounded-md px-2 py-1.5 text-left text-sm font-bold " +
                  (sel?.id === parent.id ? "bg-[#0033A0] text-white" : "bg-neutral-100 text-[#0A2540] hover:bg-neutral-200")
                }
              >
                {parent.name}
              </button>
              {parent.children.length > 0 && (
                <div className="ml-3 space-y-1 border-l border-neutral-200 pl-2">
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
          {orphans.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="text-[11px] text-neutral-400">기타 세부유형</div>
              {orphans.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id, c.name)}
                  className={
                    "w-full rounded-md px-2 py-1 text-left text-sm " +
                    (sel?.id === c.id ? "bg-[#0033A0] text-white" : "text-neutral-700 hover:bg-neutral-100")
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 단계별 가이드 편집 */}
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3">
          {!sel ? (
            <p className="text-sm text-neutral-400">왼쪽에서 구조물을 선택하세요.</p>
          ) : loading ? (
            <p className="text-sm text-neutral-400">불러오는 중...</p>
          ) : phases.length === 0 ? (
            <p className="text-sm text-neutral-400">
              <b>{sel.name}</b>에 등록된 단계(phaseTemplate)가 없습니다. 단계 템플릿을 먼저 등록해야 가이드를 작성할 수 있어요.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-[#0A2540]">{sel.name} · 단계별 가이드</div>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-[#0033A0] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
              {msg && <p className="text-sm text-[#0033A0]">{msg}</p>}
              {phases.map((p, i) => (
                <div key={p.id} className="space-y-1">
                  <label className="text-sm font-semibold text-[#0A2540]">
                    {i + 1}. {p.name}
                  </label>
                  <textarea
                    className={taCls}
                    defaultValue={p.guideText || ""}
                    placeholder="이 단계에서 촬영·검측해야 할 항목, 확인 기준 등을 작성하세요. (예: 스타프로 폭/높이 측정, 철근 간격 확인 등)"
                    onChange={(e) => setEdited((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
