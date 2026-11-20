"use client";

import { useEffect, useState, useCallback } from "react";

type Group = {
  subTypeId: string;
  subName: string;
  parentName: string;
  items: { itemNo: number; checkItem: string; standard: string | null }[];
};

export default function ChecklistPresetsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/checklist-presets");
      const d = await res.json();
      if (res.ok && d.ok) {
        setGroups(d.groups || []);
        setTotalItems(d.totalItems || 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/checklist-presets/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setMsg("❌ " + (d.error || "업로드 실패"));
        return;
      }
      setMsg(`✅ 업로드 완료 — 공종 ${d.subTypes}개 / 항목 ${d.items}개 반영`);
      await load();
    } catch (e) {
      setMsg("❌ 오류: " + (e instanceof Error ? e.message : "네트워크"));
    } finally {
      setBusy(false);
    }
  }

  async function clearOne(subTypeId: string, name: string) {
    if (!confirm(`'${name}' 공종의 체크리스트 프리셋을 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/checklist-presets?subTypeId=${subTypeId}`, { method: "DELETE" });
    if (res.ok) load();
    else alert("삭제 실패");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 체크리스트 양식 관리</h1>
        <p className="text-sm text-neutral-500">
          공종별 검사항목을 엑셀로 미리 셋팅합니다. 시공사가 검측요청서를 작성할 때 공종을 선택하면 이 항목이 초안으로 자동 채워집니다.
        </p>
      </div>

      {/* 다운로드 / 업로드 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-bold text-[#0A2540]">1. 양식 다운로드</div>
          <p className="mb-3 text-xs text-neutral-500">
            모든 공종이 미리 채워진 엑셀 양식을 받아 검사항목을 입력하세요.
          </p>
          <a
            href="/api/admin/checklist-presets/template"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0033A0] px-3 py-2 text-sm font-bold text-white hover:bg-[#002A80]"
          >
            ⬇ 엑셀 양식 다운로드
          </a>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-bold text-[#0A2540]">2. 작성한 양식 업로드</div>
          <p className="mb-3 text-xs text-neutral-500">
            작성한 .xlsx 파일을 올리면 해당 공종 프리셋이 교체됩니다.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#FE5000] px-3 py-2 text-sm font-bold text-white hover:bg-[#E04800]">
            {busy ? "업로드 중..." : "⬆ 엑셀 업로드"}
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {msg && <p className="rounded-md bg-neutral-50 p-2 text-sm">{msg}</p>}

      {/* 현재 저장 상태 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-[#0A2540]">
            현재 저장된 프리셋 (공종 {groups.length}개 · 항목 {totalItems}개)
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-neutral-400">불러오는 중...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 저장된 프리셋이 없습니다. 양식을 다운로드해 작성 후 업로드하세요.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.subTypeId} className="rounded-xl border border-neutral-200">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => setOpen(open === g.subTypeId ? null : g.subTypeId)}
                  >
                    <span className="text-xs text-neutral-400">{g.parentName}</span>{" "}
                    <span className="font-semibold text-[#0A2540]">{g.subName}</span>{" "}
                    <span className="text-xs text-neutral-500">· {g.items.length}개 {open === g.subTypeId ? "▲" : "▼"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => clearOne(g.subTypeId, g.subName)}
                    className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs text-red-600 hover:bg-neutral-50"
                  >
                    삭제
                  </button>
                </div>
                {open === g.subTypeId && (
                  <div className="border-t border-neutral-100 px-3 py-2">
                    <ol className="space-y-1 text-sm">
                      {g.items.map((it, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-5 shrink-0 text-right text-xs font-bold text-neutral-400">{it.itemNo}</span>
                          <div>
                            <span className="text-neutral-800">{it.checkItem}</span>
                            {it.standard && <span className="ml-1 text-xs text-neutral-500">· 기준: {it.standard}</span>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
