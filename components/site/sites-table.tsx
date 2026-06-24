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

export function SitesTable({ sites, basePath }: { sites: Site[]; basePath: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_desc");

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
    const cmp = (a: Site, b: Site) => {
      switch (sort) {
        case "created_asc":
          return a.createdAt.localeCompare(b.createdAt);
        case "district":
          return a.districtName.localeCompare(b.districtName, "ko");
        case "project":
          return a.projectName.localeCompare(b.projectName, "ko");
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    };
    return [...filtered].sort(cmp);
  }, [sites, q, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="지구명·사업·시행자·주소 검색"
          className="h-9 w-full rounded-md border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30 sm:max-w-xs"
        />
        <select
          className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created_desc">등록일 최신순</option>
          <option value="created_asc">등록일 오래된순</option>
          <option value="district">지구명 가나다순</option>
          <option value="project">사업명 가나다순</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-3 py-2">지구명</th>
              <th className="px-3 py-2">사업</th>
              <th className="px-3 py-2">사업시행자</th>
              <th className="px-3 py-2">주소</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-neutral-400">
                  {sites.length === 0 ? "등록된 현장이 없습니다." : "검색 결과가 없습니다."}
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                  <td className="px-3 py-2 font-semibold text-[#0A2540]">{s.districtName}</td>
                  <td className="px-3 py-2">{s.projectName}</td>
                  <td className="px-3 py-2 text-neutral-600">{s.executor || "-"}</td>
                  <td className="px-3 py-2 text-neutral-500">{s.address}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`${basePath}/${s.id}/structures`}
                        className="whitespace-nowrap rounded-md bg-[#FE5000] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#E04800]"
                      >
                        구조물 등록 및 조회
                      </Link>
                      <Link
                        href={`${basePath}/${s.id}`}
                        className="whitespace-nowrap rounded-md border border-[#0033A0] px-2.5 py-1 text-xs font-semibold text-[#0033A0] hover:bg-[#EAF0FB]"
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
