"use client";

import { useEffect, useState, useCallback } from "react";

type Participant = {
  id: string;
  userId: string;
  name: string;
  participantRole: string;
  roleLabel: string;
  affiliation: string;
  isOwner: boolean;
};
type SearchUser = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  affiliation: string;
};

const ROLE_BADGE: Record<string, string> = {
  contractor_manager: "bg-[#002A80] text-white",
  supervisor: "bg-emerald-600 text-white",
  client_manager: "bg-[#0033A0] text-white",
  client_viewer: "bg-neutral-500 text-white",
};
const ROLE_LABEL: Record<string, string> = {
  contractor_manager: "시공사",
  supervisor: "농어촌공사",
  client_manager: "발주처",
  client_viewer: "열람",
};

export function ParticipantManager({ siteId, canManage }: { siteId: string; canManage: boolean }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/participants`);
      const data = await res.json();
      if (res.ok) setParticipants(data.participants || []);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function search() {
    if (query.trim().length < 2) {
      alert("이름을 2글자 이상 입력하세요.");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?name=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (res.ok) {
        // 이미 참여 중인 사람 제외
        const existingIds = new Set(participants.map((p) => p.userId));
        setResults((data.users || []).filter((u: SearchUser) => !existingIds.has(u.id)));
      }
    } finally {
      setSearching(false);
    }
  }

  async function invite(userId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "초대 실패");
        return;
      }
      setResults((r) => r.filter((u) => u.id !== userId));
      setQuery("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string, name: string) {
    if (!confirm(`${name} 님을 이 현장에서 내보낼까요?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "내보내기 실패");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-[#0033A0]">참여자 관리</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        이름으로 검색하여 다른 시공사·농어촌공사 직원을 이 현장에 초대할 수 있습니다.
      </p>

      {canManage && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="이름 검색 (2글자 이상)"
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={search}
              disabled={searching}
              className="rounded-md bg-[#0033A0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {searching ? "검색중" : "검색"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-2 space-y-1 rounded-md border border-neutral-200 p-2">
              {results.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-neutral-50">
                  <div>
                    <span className="text-sm font-medium text-neutral-800">{u.name}</span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {u.roleLabel} · {u.affiliation}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => invite(u.id)}
                    disabled={busy}
                    className="rounded bg-[#002A80] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    초대
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-neutral-500">참여자 ({participants.length})</p>
        {loading ? (
          <p className="text-sm text-neutral-400">불러오는 중...</p>
        ) : participants.length === 0 ? (
          <p className="text-sm text-neutral-400">참여자가 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-800">{p.name}</span>
                  <span className={"rounded px-1.5 py-0.5 text-xs font-semibold " + (ROLE_BADGE[p.participantRole] || "bg-neutral-400 text-white")}>
                    {ROLE_LABEL[p.participantRole] || p.roleLabel}
                  </span>
                  {p.isOwner && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">현장 생성자</span>}
                  <span className="text-xs text-neutral-400">{p.affiliation}</span>
                </div>
                {canManage && !p.isOwner && (
                  <button
                    type="button"
                    onClick={() => remove(p.userId, p.name)}
                    disabled={busy}
                    className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
                  >
                    내보내기
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
