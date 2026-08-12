"use client";
import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/kit/stat-card";

type Activity = { sites: number; structures: number; records: number; requests: number; participations: number };
type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  branch: string | null;
  role: "contractor" | "supervisor" | "client" | "admin";
  status: "pending" | "active" | "suspended" | "deleted";
  lastLoginAt: string | null;
  createdAt: string;
  activity?: Activity;
};
type Stats = { total: number; active: number; suspended: number; contractor: number; krc: number };

const ROLE_LABEL: Record<string, string> = {
  contractor: "시공사",
  supervisor: "공사감독원",
  client: "발주처(농어촌공사)",
  admin: "관리자",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "미가입",
  active: "이용 중",
  suspended: "정지",
  deleted: "삭제됨",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-[#FFF4EC] text-[#FE5000]",
  active: "bg-[#EAF6EE] text-[#0F9D58]",
  suspended: "bg-[#FDECEC] text-[#D33]",
  deleted: "bg-neutral-100 text-neutral-400 line-through",
};

function fmtDate(s: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, suspended: 0, contractor: 0, krc: 0 });
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");

  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [q, setQ] = useState("");

  // 수정 모달
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [ef, setEf] = useState({ name: "", email: "", phone: "", role: "", branch: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (role) p.set("role", role);
      if (status) p.set("status", status);
      if (branch) p.set("branch", branch);
      if (q.trim()) p.set("q", q.trim());
      const res = await fetch(`/api/admin/users?${p.toString()}`);
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setRows(d.users || []);
        setStats(d.stats || stats);
        setBranches(d.branches || []);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status, branch, q]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status, branch]);

  async function patchUser(id: string, body: Record<string, any>) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) await load();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "처리 실패");
      }
    } finally {
      setBusyId("");
    }
  }

  function openEdit(u: Row) {
    setEditRow(u);
    setEf({ name: u.name, email: u.email || "", phone: u.phone || "", role: u.role, branch: u.branch || "" });
  }
  async function saveEdit() {
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editRow.id,
          name: ef.name,
          email: ef.email,
          phone: ef.phone,
          role: ef.role,
          branch: ef.branch,
        }),
      });
      if (res.ok) {
        setEditRow(null);
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  function resetFilters() {
    setRole("");
    setStatus("");
    setBranch("");
    setQ("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">가입자 관리</h1>
        <p className="text-sm text-neutral-500">
          가입한 사용자 명단·활동을 조회하고 정보를 수정합니다. 문제가 있으면 정지하고, 정지된 계정은 삭제할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard value={stats.total} label="전체 가입자" />
        <StatCard value={stats.active} label="이용 중" />
        <StatCard value={stats.suspended} label="정지" accent />
        <StatCard value={stats.contractor} label="시공사" />
        <StatCard value={stats.krc} label="농어촌공사" />
      </div>

      {/* 필터 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">소속</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">전체</option>
              <option value="contractor">시공사</option>
              <option value="supervisor">공사감독원</option>
              <option value="client">발주처(농어촌공사)</option>
              <option value="admin">관리자</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">상태</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">전체</option>
              <option value="active">이용 중</option>
              <option value="suspended">정지</option>
              <option value="deleted">삭제됨</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">소속 지사</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">전체</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">이름·이메일·전화 검색</label>
            <div className="flex gap-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") load(); }}
                placeholder="검색어 입력 후 Enter"
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <button type="button" onClick={load} className="whitespace-nowrap rounded-md bg-[#0033A0] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#002A80]">검색</button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-400">{loading ? "불러오는 중..." : `총 ${rows.length}명`}</span>
          <button type="button" onClick={resetFilters} className="text-xs text-neutral-500 underline hover:text-neutral-700">필터 초기화</button>
        </div>
      </div>

      {/* 명단 */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2.5">이름</th>
              <th className="px-3 py-2.5">이메일</th>
              <th className="px-3 py-2.5">전화</th>
              <th className="px-3 py-2.5">소속</th>
              <th className="px-3 py-2.5">지사</th>
              <th className="px-3 py-2.5">활동 (현장/구조물/검측/요청)</th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5">가입일</th>
              <th className="px-3 py-2.5 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-400">조건에 맞는 가입자가 없습니다.</td></tr>
            )}
            {rows.map((u) => {
              const a = u.activity;
              return (
                <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-semibold text-neutral-800">{u.name}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{u.email || "-"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{u.phone || "-"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{ROLE_LABEL[u.role] || u.role}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{u.branch || "-"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">
                    {a ? (
                      <span className="text-xs">
                        현장 <b className="text-[#0033A0]">{a.sites}</b> · 구조물 <b className="text-[#0033A0]">{a.structures}</b> · 검측 <b className="text-[#0033A0]">{a.records}</b> · 요청 <b className="text-[#0033A0]">{a.requests}</b>
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[u.status]}`}>{STATUS_LABEL[u.status]}</span>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">{fmtDate(u.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEdit(u)} className="rounded-md border border-[#0033A0] px-2 py-1 text-xs font-semibold text-[#0033A0] hover:bg-[#EAF0FB]">수정</button>
                      {u.status === "active" && u.role !== "admin" && (
                        <button type="button" disabled={busyId === u.id} onClick={() => { if (confirm(`${u.name} 님을 정지하시겠습니까? 정지하면 로그인할 수 없습니다.`)) patchUser(u.id, { status: "suspended" }); }} className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 disabled:opacity-50">정지</button>
                      )}
                      {u.status === "suspended" && (
                        <>
                          <button type="button" disabled={busyId === u.id} onClick={() => patchUser(u.id, { status: "active" })} className="rounded-md border border-[#0F9D58] px-2 py-1 text-xs font-semibold text-[#0F9D58] hover:bg-[#EAF6EE] disabled:opacity-50">해제</button>
                          <button type="button" disabled={busyId === u.id} onClick={() => { if (confirm(`${u.name} 님을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) patchUser(u.id, { status: "deleted" }); }} className="rounded-md border border-[#D33] px-2 py-1 text-xs font-semibold text-[#D33] hover:bg-[#FDECEC] disabled:opacity-50">삭제</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 수정 모달 */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditRow(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-bold text-[#0033A0]">가입자 정보 수정</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500">이름</label>
                <input value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500">이메일</label>
                <input value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} placeholder="example@ekr.or.kr" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500">전화번호</label>
                <input value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500">소속</label>
                <select value={ef.role} onChange={(e) => setEf({ ...ef, role: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
                  <option value="contractor">시공사</option>
                  <option value="client">한국농어촌공사</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500">소속 지사</label>
                <input value={ef.branch} onChange={(e) => setEf({ ...ef, branch: e.target.value })} placeholder="예: 충남지역본부 ○○지사" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditRow(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">취소</button>
              <button type="button" disabled={saving} onClick={saveEdit} className="rounded-md bg-[#0033A0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002A80] disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
