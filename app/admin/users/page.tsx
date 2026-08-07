"use client";
import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/kit/stat-card";

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
};
type Stats = { total: number; pending: number; active: number; contractor: number; krc: number };

const ROLE_LABEL: Record<string, string> = {
  contractor: "시공사",
  supervisor: "공사감독원",
  client: "발주처(농어촌공사)",
  admin: "관리자",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기",
  active: "활성",
  suspended: "정지",
  deleted: "삭제",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-[#FFF4EC] text-[#FE5000]",
  active: "bg-[#EAF6EE] text-[#0F9D58]",
  suspended: "bg-neutral-100 text-neutral-500",
  deleted: "bg-neutral-100 text-neutral-400 line-through",
};

function fmtDate(s: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, active: 0, contractor: 0, krc: 0 });
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");

  // 필터
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [q, setQ] = useState("");

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

  async function changeStatus(id: string, next: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (res.ok) await load();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "변경 실패");
      }
    } finally {
      setBusyId("");
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
        <p className="text-sm text-neutral-500">가입한 사용자 명단을 조회하고 승인·정지를 관리합니다.</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard value={stats.total} label="전체 가입자" />
        <StatCard value={stats.pending} label="승인 대기" accent />
        <StatCard value={stats.active} label="활성" />
        <StatCard value={stats.contractor} label="시공사" />
        <StatCard value={stats.krc} label="농어촌공사" />
      </div>

      {/* 필터 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">소속</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              <option value="contractor">시공사</option>
              <option value="supervisor">공사감독원</option>
              <option value="client">발주처(농어촌공사)</option>
              <option value="admin">관리자</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              <option value="pending">승인 대기</option>
              <option value="active">활성</option>
              <option value="suspended">정지</option>
              <option value="deleted">삭제</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">소속 지사</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-500">이름·이메일·전화 검색</label>
            <div className="flex gap-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                placeholder="검색어 입력 후 Enter"
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={load}
                className="whitespace-nowrap rounded-md bg-[#0033A0] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#002A80]"
              >
                검색
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            {loading ? "불러오는 중..." : `총 ${rows.length}명`}
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 명단 테이블 */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2.5">이름</th>
              <th className="px-3 py-2.5">이메일</th>
              <th className="px-3 py-2.5">전화</th>
              <th className="px-3 py-2.5">소속</th>
              <th className="px-3 py-2.5">지사</th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5">가입일</th>
              <th className="px-3 py-2.5">최근 로그인</th>
              <th className="px-3 py-2.5 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-400">
                  조건에 맞는 가입자가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-3 py-2.5 font-semibold text-neutral-800">{u.name}</td>
                <td className="px-3 py-2.5 text-neutral-600">{u.email || "-"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{u.phone || "-"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{ROLE_LABEL[u.role] || u.role}</td>
                <td className="px-3 py-2.5 text-neutral-600">{u.branch || "-"}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[u.status]}`}>
                    {STATUS_LABEL[u.status]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-neutral-500">{fmtDate(u.createdAt)}</td>
                <td className="px-3 py-2.5 text-neutral-500">{fmtDate(u.lastLoginAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    {u.status !== "active" && (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => changeStatus(u.id, "active")}
                        className="rounded-md border border-[#0F9D58] px-2 py-1 text-xs font-semibold text-[#0F9D58] hover:bg-[#EAF6EE] disabled:opacity-50"
                      >
                        승인
                      </button>
                    )}
                    {u.status !== "suspended" && u.role !== "admin" && (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => changeStatus(u.id, "suspended")}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        정지
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
