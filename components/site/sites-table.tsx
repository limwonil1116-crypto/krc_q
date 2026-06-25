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

function periodInfo(s: Site): { period: string; phase: "ongoing" | "done" | "" } {
  const start = s.startedOn || "";
  const end = s.endedOn || "";
  const period = start || end ? `${start || "?"} ~ ${end || "?"}` : "";
  let phase: "ongoing" | "done" | "" = "";
  if (end) phase = todayStr() <= end ? "ongoing" : "done";
  return { period, phase };
}

function PhaseBadge({ phase }: { phase: "ongoing" | "done" | "" }) {
  if (phase === "ongoing")
    return (
      <span className="w-fit rounded-full bg-[#0033A0]/10 px-2 py-0.5 text-xs font-semibold text-[#0033A0]">시행중</span>
    );
  if (phase === "done")
    return <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">준공</span>;
  return null;
}

export function SitesTable({ sites, basePath }: { sites: Site[]; basePath: string }) {
  const [q, setQ] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fProject, setFProject] = useState("");
  const [fExecutor, setFExecutor] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("seq");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const seqMap = useMemo(() => {
    const m = new Map<string, number>();
    [...sites].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sites]);

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
      {/* 검색 + 필터(모바일/PC 공통) */}
      <div className="space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="전체 검색 (지구명·사업·시행자·주소)"
          className="h-12 w-full rounded-md border border-neutral-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select className="h-10 rounded border border-neutral-300 bg-white px-2 text-sm" value={fDistrict} onChange={(e) => setFDistrict(e.target.value)}>
            <option value="">지구 전체</option>
            {opts.district.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select className="h-10 rounded border border-neutral-300 bg-white px-2 text-sm" value={fProject} onChange={(e) => setFProject(e.target.value)}>
            <option value="">사업 전체</option>
            {opts.project.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select className="h-10 rounded border border-neutral-300 bg-white px-2 text-sm" value={fExecutor} onChange={(e) => setFExecutor(e.target.value)}>
            <option value="">시행자 전체</option>
            {opts.executor.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <input
            value={fAddress}
            onChange={(e) => setFAddress(e.target.value)}
            placeholder="주소 포함"
            className="h-10 rounded border border-neutral-300 bg-white px-2 text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">총 {rows.length}건</span>
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
        </div>
      </div>

      {/* === 모바일: 지구 카드 === */}
      <div className="space-y-3 sm:hidden">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
            {sites.length === 0 ? "등록된 현장이 없습니다." : "조건에 맞는 현장이 없습니다."}
          </div>
        ) : (
          rows.map((s) => {
            const { period, phase } = periodInfo(s);
            return (
              <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#0033A0] px-2 py-0.5 text-xs font-bold text-white">
                        {seqMap.get(s.id)}
                      </span>
                      <span className="text-lg font-bold text-[#0A2540]">{s.districtName}</span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">{s.projectName}</div>
                  </div>
                  <PhaseBadge phase={phase} />
                </div>
                <div className="mt-2 space-y-0.5 text-sm text-neutral-500">
                  <div>시행자: {s.executor || "-"}</div>
                  <div className="truncate">주소: {s.address}</div>
                  {period && <div>공사기간: {period}</div>}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Link
                    href={`${basePath}/${s.id}/structures`}
                    className="flex h-12 items-center justify-center rounded-xl bg-[#FE5000] text-base font-bold text-white hover:bg-[#E04800]"
                  >
                    구조물 등록 및 조회
                  </Link>
                  <Link
                    href={`${basePath}/${s.id}`}
                    className="flex h-12 items-center justify-center rounded-xl border-2 border-[#0033A0] text-base font-bold text-[#0033A0] hover:bg-[#EAF0FB]"
                  >
                    현장 수정·조회
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* === PC: 표 === */}
      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white sm:block">
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
                    <option key={v} value={v}>{v}</option>
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
                    <option key={v} value={v}>{v}</option>
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
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </th>
              <th className="px-3 py-2.5">
                <button type="button" className={thBtn} onClick={() => toggleSort("address")}>
                  주소{arrow("address")}
                </button>
                <input value={fAddress} onChange={(e) => setFAddress(e.target.value)} placeholder="주소 포함" className={selCls} />
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
                        <PhaseBadge phase={phase} />
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
