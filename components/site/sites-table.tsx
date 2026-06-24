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
  startedOn: string | null;
  endedOn: string | null;
  createdAt: string;
};

type SortKey = "seq" | "districtName" | "projectName" | "executor" | "address";
type SortDir = "asc" | "desc";

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// 공사기간/상태: 종료일 이전=시행중, 이후=준공, 없으면 공란
function periodInfo(s: Site): { period: string; phase: "ongoing" | "done" | "" } {
  const start = s.startedOn || "";
  const end = s.endedOn || "";
  const period = start || end ? `${start || "?"} ~ ${end || "?"}` : "";
  let phase: "ongoing" | "done" | "" = "";
  if (end) phase = todayStr() <= end ? "ongoing" : "done";
  return { period, phase };
}

export function SitesTable({ sites, basePath }: { sites: Site[]; basePath: string }) {
  const [q, setQ] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fProject, setFProject] = useState("");
  const [fExecutor, setFExecutor] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("seq");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // 등록 순번: createdAt 오름차순 1번부터 고정
  const seqMap = useMemo(() => {
    const m = new Map<string, number>();
    [...sites].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sites]);

  // 열별 필터 옵션(고유값)
  const opts = useMemo(() => {
    const uniq = (arr: (string | null)[]) =>
      Array.from(new Set(arr.map((x) => (x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"));
    return {
      district: uniq(sites.map((s) => s.districtName)),
      project: uniq(sites.map((s) => s.projectName)),
      executor: uniq(sites.map((s) => s.executor)),
    };
  }, [sites]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const filtered = sites.filter((s) => {
      if (kw) {
        const hay = [s.districtName, s.projectName, s.executor, s.workType, s.address, s.supervisorName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (fDistrict && s.districtName !== fDistrict) return false;
      if (fProject && s.projectName !== fProject) return false;
      if (fExecutor && (s.executor || "") !== fExecutor) return false;
      if (fAddress && !s.address.toLowerCase().includes(fAddress.trim().toLowerCase())) return false;
      return true;
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
  }, [sites, q, fDistrict, fProject, fExecutor, fAddress, sortKey, sortDir, seqMap]);

  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const thBtn = "flex items-center gap-0.5 font-semibold hover:text-[#0033A0]";
  const selCls = "mt-1 h-8 w-full rounded border border-neutral-200 bg-white px-1 text-xs font-normal text-neutral-700";
  const hasFilter = q || fDistrict || fProject || fExecutor || fAddress;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="전체 검색 (지구명·사업·시행자·주소)"
          className="h-11 w-full rounded-md border border-neutral-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30 sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFDistrict("");
                setFProject("");
                setFExecutor("");
                setFAddress("");
              }}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              필터 초기화
            </button>
          )}
          <span className="text-sm text-neutral-500">총 {rows.length}건</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr className="align-top">
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("seq")}>
                  구분{arrow("seq")}
                </button>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("districtName")}>
                  지구명{arrow("districtName")}
                </button>
                <select className={selCls} value={fDistrict} onChange={(e) => setFDistrict(e.target.value)}>
                  <option value="">전체</option>
                  {opts.district.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("projectName")}>
                  사업{arrow("projectName")}
                </button>
                <select className={selCls} value={fProject} onChange={(e) => setFProject(e.target.value)}>
                  <option value="">전체</option>
                  {opts.project.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("executor")}>
                  사업시행자{arrow("executor")}
                </button>
                <select className={selCls} value={fExecutor} onChange={(e) => setFExecutor(e.target.value)}>
                  <option value="">전체</option>
                  {opts.executor.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("address")}>
                  주소{arrow("address")}
                </button>
                <input
                  value={fAddress}
                  onChange={(e) => setFAddress(e.target.value)}
                  placeholder="주소 포함"
                  className={selCls}
                />
              </th>
              <th className="px-3 py-2.5">공사기간</th>
              <th className="px-3 py-2.5 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-neutral-400">
                  {sites.length === 0 ? "등록된 현장이 없습니다." : "조건에 맞는 현장이 없습니다."}
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const { period, phase } = periodInfo(s);
                return (
                  <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-2.5 font-bold text-[#0033A0]">{seqMap.get(s.id)}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#0A2540]">{s.districtName}</td>
                    <td className="px-3 py-2.5">{s.projectName}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{s.executor || "-"}</td>
                    <td className="px-3 py-2.5 text-neutral-500">{s.address}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-600">{period || "-"}</span>
                        {phase === "ongoing" && (
                          <span className="w-fit rounded-full bg-[#0033A0]/10 px-2 py-0.5 text-xs font-semibold text-[#0033A0]">
                            시행중
                          </span>
                        )}
                        {phase === "done" && (
                          <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            준공
                          </span>
                        )}
                      </div>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
