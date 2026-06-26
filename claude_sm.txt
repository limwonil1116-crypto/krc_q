"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StepSection } from "@/components/kit/step-section";
import { SelectableCard } from "@/components/kit/selectable-card";
import { ActionButton } from "@/components/kit/buttons";
import { KakaoMapPicker } from "@/components/kit/kakao-map-picker";

const CAT_ICON: Record<string, string> = {
  FILLDAM: "🏞️",
  TUNNEL: "🚇",
  WEIR: "🌊",
  PUMP: "⚙️",
  CHANNEL: "💧",
  PIPELINE: "🛢️",
  LANDFILL: "⛰️",
  LANDADJ: "🟫",
  FARMROAD: "🛣️",
  CULVERT: "🕳️",
  SLUICEGATE: "🚪",
};

const NAME_SAMPLE: Record<string, string> = {
  FILLDAM: "예: 00저수지",
  TUNNEL: "예: 00간선",
  WEIR: "예: 00보",
  PUMP: "예: 00양수장, 00배수장",
  CHANNEL: "예: 00배수간선, 00용수지거",
  PIPELINE: "예: 00배수간선, 00용수지거",
  LANDFILL: "예: 00유역",
  LANDADJ: "예: 00배수간선, 00용수지거",
  FARMROAD: "예: 00농도",
  CULVERT: "예: 00암거",
  SLUICEGATE: "예: 00배수문",
};

// 구조물별 고정 색 팔레트 (순환)
const PALETTE = [
  "#E53935", "#FB8C00", "#FDD835", "#43A047", "#00ACC1",
  "#1E88E5", "#3949AB", "#8E24AA", "#D81B60", "#6D4C41",
];

type Cat = { id: string; code: string; name: string };
type S = {
  id: string;
  name: string;
  structureTypeId: string;
  locationDescription: string | null;
  status: string;
  typeName: string;
  parentName: string | null;
};
type DayRec = { date: string; submitted: boolean };
type Tab = "register" | "list" | "calendar";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function StructureManager({
  siteId,
  structureBase,
  categories,
  structures,
  recordsByStructure = {},
}: {
  siteId: string;
  structureBase: string;
  categories: Cat[];
  structures: S[];
  recordsByStructure?: Record<string, DayRec[]>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("register");

  // 등록 폼
  const [catId, setCatId] = useState("");
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapVal, setMapVal] = useState<{ lat: number | null; lng: number | null; address: string }>({
    lat: null,
    lng: null,
    address: "",
  });

  // 목록 수정
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [editErr, setEditErr] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // 구조물 -> 색
  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    structures.forEach((s, i) => {
      map[s.id] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [structures]);

  async function add() {
    setError("");
    if (!catId) {
      setError("대분류를 선택하세요.");
      return;
    }
    if (!name.trim()) {
      setError("구조물 이름을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/structures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structureTypeId: catId, name: name.trim(), locationDescription: loc.trim() }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        setError(data.error || ("서버 오류 (" + res.status + ")"));
        return;
      }
      setCatId("");
      setName("");
      setLoc("");
      setMapVal({ lat: null, lng: null, address: "" });
      setTab("list");
      router.refresh();
    } catch (e) {
      setError("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setLoading(false);
    }
  }

  function startEdit(s: S) {
    setEditId(s.id);
    setEditName(s.name);
    setEditLoc(s.locationDescription ?? "");
    setEditErr("");
  }

  async function saveEdit(id: string) {
    setEditErr("");
    if (!editName.trim()) {
      setEditErr("이름을 입력하세요.");
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/structures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), locationDescription: editLoc.trim() }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        setEditErr(data.error || ("서버 오류 (" + res.status + ")"));
        return;
      }
      setEditId(null);
      router.refresh();
    } catch (e) {
      setEditErr("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setEditLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 구조물을 삭제할까요? 관련 기록도 함께 삭제됩니다.")) return;
    try {
      const res = await fetch(`/api/sites/${siteId}/structures/${id}`, { method: "DELETE" });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        alert(data.error || "삭제 실패");
        return;
      }
      router.refresh();
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  const sampleHolder = catId
    ? NAME_SAMPLE[categories.find((c) => c.id === catId)?.code || ""] || "구조물 이름"
    : "먼저 대분류를 선택하세요";

  const tabBtn = (t: Tab, label: string) =>
    `flex-1 rounded-lg px-3 py-2.5 text-base font-bold transition ${
      tab === t ? "bg-[#0033A0] text-white shadow" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
    }`;

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-[#0033A0]">구조물 등록 및 조회</h1>

      {/* 탭 */}
      <div className="flex gap-2">
        <button type="button" className={tabBtn("register", "등록")} onClick={() => setTab("register")}>
          등록
        </button>
        <button type="button" className={tabBtn("list", "구조물 목록")} onClick={() => setTab("list")}>
          구조물 목록
        </button>
        <button type="button" className={tabBtn("calendar", "캘린더")} onClick={() => setTab("calendar")}>
          캘린더
        </button>
      </div>

      {/* 탭1: 등록 */}
      {tab === "register" && (
        <StepSection
          step="STEP 04"
          title="구조물(대분류) 등록"
          desc="대분류를 선택하고 이름을 붙여 추가하세요. 세부 항목은 등록 후 기록 화면에서 선택합니다."
        >
          <Label>대분류</Label>
          <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {categories.map((c) => (
              <SelectableCard
                key={c.id}
                label={c.name}
                icon={CAT_ICON[c.code] || "🏗️"}
                selected={catId === c.id}
                onClick={() => setCatId(c.id)}
              />
            ))}
          </div>

          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label>구조물 이름 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={sampleHolder} />
            </div>
            <div className="space-y-1">
              <Label>위치 설명 (지도에서 선택)</Label>
              <Input
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="지도를 클릭하거나 주소를 검색하세요 (직접 입력도 가능)"
              />
              <div className="pt-2">
                <KakaoMapPicker
                  value={mapVal}
                  onChange={(v) => {
                    setMapVal(v);
                    setLoc(v.address);
                  }}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <ActionButton className="w-full" onClick={add} disabled={loading}>
              {loading ? "추가 중..." : "+ 구조물 추가"}
            </ActionButton>
          </div>
        </StepSection>
      )}

      {/* 탭2: 구조물 목록 */}
      {tab === "list" && (
        <StepSection title={`등록된 구조물 (${structures.length})`}>
          {structures.length === 0 ? (
            <p className="text-sm text-neutral-500">아직 추가된 구조물이 없습니다. ‘등록’ 탭에서 추가하세요.</p>
          ) : (
            <div className="space-y-2">
              {structures.map((s) => (
                <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                  {editId === s.id ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label>구조물 이름 *</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>위치 설명</Label>
                        <Input value={editLoc} onChange={(e) => setEditLoc(e.target.value)} />
                      </div>
                      {editErr && <p className="text-sm text-red-600">{editErr}</p>}
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setEditId(null)}>
                          취소
                        </Button>
                        <ActionButton className="flex-1" onClick={() => saveEdit(s.id)} disabled={editLoading}>
                          {editLoading ? "저장 중..." : "저장"}
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: colorOf[s.id] }}
                          />
                          <div>
                            <div className="font-semibold text-[#0A2540]">{s.name}</div>
                            <div className="text-xs text-neutral-500">
                              {s.typeName}
                              {s.locationDescription ? ` · ${s.locationDescription}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" onClick={() => startEdit(s)}>
                            수정
                          </Button>
                          <Button type="button" variant="outline" className="text-red-600" onClick={() => remove(s.id)}>
                            삭제
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Link
                          href={`${structureBase}/${s.id}`}
                          className="whitespace-nowrap rounded-md bg-[#0033A0] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#002A80]"
                        >
                          세부항목·검측 기록 →
                        </Link>
                        <Link
                          href={`${structureBase}/${s.id}/video`}
                          className="whitespace-nowrap rounded-md bg-[#FE5000] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#E04800]"
                        >
                          ▶ 영상 미리보기
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </StepSection>
      )}

      {/* 탭3: 캘린더 */}
      {tab === "calendar" && (
        <SiteCalendar
          structures={structures}
          recordsByStructure={recordsByStructure}
          colorOf={colorOf}
          structureBase={structureBase}
        />
      )}
    </div>
  );
}

function SiteCalendar({
  structures,
  recordsByStructure,
  colorOf,
  structureBase,
}: {
  structures: S[];
  recordsByStructure: Record<string, DayRec[]>;
  colorOf: Record<string, string>;
  structureBase: string;
}) {
  const router = useRouter();
  const now = new Date();
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());

  // 날짜 -> [{structure, color, submitted}]
  const byDate = useMemo(() => {
    const map: Record<string, { s: S; color: string; submitted: boolean }[]> = {};
    structures.forEach((s) => {
      (recordsByStructure[s.id] || []).forEach((d) => {
        const arr = (map[d.date] ||= []);
        arr.push({ s, color: colorOf[s.id], submitted: d.submitted });
      });
    });
    return map;
  }, [structures, recordsByStructure, colorOf]);

  const startWeekday = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const today = ymd(new Date());
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(vy, vm, d)));

  function prevMonth() {
    if (vm === 0) {
      setVy(vy - 1);
      setVm(11);
    } else setVm(vm - 1);
  }
  function nextMonth() {
    if (vm === 11) {
      setVy(vy + 1);
      setVm(0);
    } else setVm(vm + 1);
  }

  const activeStructures = structures.filter((s) => (recordsByStructure[s.id] || []).length > 0);

  return (
    <div className="space-y-3">
      {/* 범례 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-[#0A2540]">구조물별 색상</span>
          <span className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-orange-500" />기록중</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />제출완료</span>
          </span>
        </div>
        {activeStructures.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 기록된 검측일자가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeStructures.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-2.5 py-1 text-sm">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colorOf[s.id] }} />
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 달력 */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="rounded-md px-3 py-1 text-lg text-[#0033A0] hover:bg-neutral-100">
            ◀
          </button>
          <div className="font-bold text-[#0033A0]">
            {vy}년 {vm + 1}월
          </div>
          <button type="button" onClick={nextMonth} className="rounded-md px-3 py-1 text-lg text-[#0033A0] hover:bg-neutral-100">
            ▶
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WD.map((w, i) => (
            <div key={w} className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-neutral-400"}>
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((c, i) =>
            c === null ? (
              <div key={i} />
            ) : (
              <div key={i} className="min-h-[60px] rounded-lg border border-neutral-100 p-1">
                <div
                  className={
                    "mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] " +
                    (c === today ? "bg-[#0033A0] font-bold text-white" : "text-neutral-700")
                  }
                >
                  {Number(c.split("-")[2])}
                </div>
                <div className="space-y-0.5">
                  {(byDate[c] || []).map((it, k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => router.push(`${structureBase}/${it.s.id}`)}
                      title={`${it.s.name} (${it.s.typeName})${it.submitted ? " · 제출완료" : " · 기록중"}`}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[9px] font-semibold text-white"
                      style={{ backgroundColor: it.color }}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full border border-white"
                        style={{ backgroundColor: it.submitted ? "#22c55e" : "#f97316" }}
                      />
                      <span className="truncate">{it.s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
        <p className="mt-2 text-center text-xs text-neutral-400">막대를 누르면 해당 구조물 기록 화면으로 이동합니다.</p>
      </div>
    </div>
  );
}
