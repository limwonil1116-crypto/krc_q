"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Site = {
  id: string;
  districtName: string;
  projectName: string;
  executor: string | null;
  workType: string | null;
  address: string;
  status: string;
  supervisorName: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  active: "진행중",
  completed: "완료",
  archived: "보관",
};

type SortKey = "seq" | "districtName" | "projectName" | "executor" | "address";
type SortDir = "asc" | "desc";

export function SitesTable({ sites, basePath }: { sites: Site[]; basePath: string }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("seq");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // 등록 순번: 등록일(createdAt) 오름차순으로 1번부터 고정 부여
  const seqMap = useMemo(() => {
    const m = new Map<string, number>();
    [...sites]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sites]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const filtered = sites.filter((s) => {
      if (!kw) return true;
      return [s.districtName, s.projectName, s.executor, s.workType, s.address, s.supervisorName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(kw);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Site, b: Site) => {
      switch (sortKey) {
        case "districtName":
          return a.districtName.localeCompare(b.districtName, "ko") * dir;
        case "projectName":
          return a.projectName.localeCompare(b.projectName, "ko") * dir;
        case "executor":
          return (a.executor || "").localeCompare(b.executor || "", "ko") * dir;
        case "address":
          return a.address.localeCompare(b.address, "ko") * dir;
        case "seq":
        default:
          return ((seqMap.get(a.id) || 0) - (seqMap.get(b.id) || 0)) * dir;
      }
    };
    return [...filtered].sort(cmp);
  }, [sites, q, sortKey, sortDir, seqMap]);

  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const thBtn = "flex items-center gap-0.5 font-semibold hover:text-[#0033A0]";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="지구명·사업·시행자·주소 검색"
          className="h-11 w-full rounded-md border border-neutral-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30 sm:max-w-xs"
        />
        <span className="text-sm text-neutral-500">총 {rows.length}건</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("seq")}>
                  구분{arrow("seq")}
                </button>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("districtName")}>
                  지구명{arrow("districtName")}
                </button>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("projectName")}>
                  사업{arrow("projectName")}
                </button>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("executor")}>
                  사업시행자{arrow("executor")}
                </button>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("address")}>
                  주소{arrow("address")}
                </button>
              </th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-neutral-400">
                  {sites.length === 0 ? "등록된 현장이 없습니다." : "검색 결과가 없습니다."}
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                  <td className="px-3 py-2.5 font-bold text-[#0033A0]">{seqMap.get(s.id)}</td>
                  <td className="px-3 py-2.5 font-semibold text-[#0A2540]">{s.districtName}</td>
                  <td className="px-3 py-2.5">{s.projectName}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{s.executor || "-"}</td>
                  <td className="px-3 py-2.5 text-neutral-500">{s.address}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`${basePath}/${s.id}/structures`}
                        className="whitespace-nowrap rounded-md bg-[#FE5000] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#E04800]"
                      >
                        구조물 등록 및 조회
                      </Link>
                      <Link
                        href={`${basePath}/${s.id}`}
                        className="whitespace-nowrap rounded-md border border-[#0033A0] px-2.5 py-1.5 text-xs font-semibold text-[#0033A0] hover:bg-[#EAF0FB]"
                      >
                        수정·조회
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
