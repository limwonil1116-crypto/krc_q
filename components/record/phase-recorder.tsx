"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { ActionButton } from "@/components/kit/buttons";
import { Button } from "@/components/ui/button";
import { AiWriteButton } from "@/components/record/ai-write-button";
import { KakaoMapPicker } from "@/components/kit/kakao-map-picker";
import { Input } from "@/components/ui/input";
import { PhotoEditor } from "@/components/record/photo-editor";

type Phase = {
  id: string;
  code: string;
  name: string;
  guideText: string | null;
  sortOrder: number;
  minPhotoCount: number;
  minVideoCount: number;
  isRequired: boolean;
};
type SubType = { id: string; name: string; guideText?: string | null };
type Rec = {
  id: string;
  phaseTemplateId: string;
  subTypeId: string | null;
  inspectionDate: string | null;
  title: string | null;
  textDescription: string | null;
  inspectionContent: string | null;
  inspectionPartFromMain: number | null;
  inspectionPartFromSub: number | null;
  inspectionPartToMain: number | null;
  inspectionPartToSub: number | null;
  voiceMemoText: string | null;
  notApplicable: boolean;
  notApplicableReason: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
};
type Asset = {
  id: string;
  phaseTemplateId: string;
  subTypeId: string | null;
  inspectionDate: string | null;
  assetType: string;
  fileName: string;
  mimeType: string;
};

const GUIDE_IMG = new Set(["F1", "F2", "F3", "F4", "F5"]);
const WD = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s: string, n: number) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function todayStr() {
  return ymd(new Date());
}

function Calendar({
  selected,
  marked,
  submitted,
  onSelect,
}: {
  selected: string;
  marked: Set<string>;
  submitted: Set<string>;
  onSelect: (d: string) => void;
}) {
  const init = selected ? parseYmd(selected) : new Date();
  const [vy, setVy] = useState(init.getFullYear());
  const [vm, setVm] = useState(init.getMonth());

  useEffect(() => {
    if (selected) {
      const d = parseYmd(selected);
      setVy(d.getFullYear());
      setVm(d.getMonth());
    }
  }, [selected]);

  const startWeekday = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const today = todayStr();
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

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-md px-3 py-1 text-lg text-[#0033A0] hover:bg-neutral-100">
          ◀
        </button>
        <div className="font-semibold text-[#0033A0]">
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
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c)}
              className={
                "flex min-h-[56px] flex-col gap-1 rounded-lg p-1 text-left hover:bg-neutral-100 " +
                (c === selected ? "ring-2 ring-[#0033A0]" : "")
              }
            >
              <span
                className={
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] " +
                  (c === selected
                    ? "bg-[#0033A0] font-bold text-white"
                    : c === today
                    ? "font-bold text-[#0033A0]"
                    : "text-neutral-700")
                }
              >
                {Number(c.split("-")[2])}
              </span>
              {submitted.has(c) ? (
                <span className="flex items-center gap-1 truncate rounded bg-green-100 px-1 py-0.5 text-[9px] font-semibold text-green-700">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  제출완료
                </span>
              ) : marked.has(c) ? (
                <span className="flex items-center gap-1 truncate rounded bg-orange-100 px-1 py-0.5 text-[9px] font-semibold text-orange-700">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  기록중
                </span>
              ) : null}
            </button>
          )
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> 기록중
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> 제출완료
        </span>
      </div>
    </div>
  );
}

export function PhaseRecorder({
  siteStructureId,
  structureName,
  typeName,
  subTypes,
  phases,
  records,
  assets,
  videoHref,
  inspectionHref,
}: {
  siteStructureId: string;
  structureName: string;
  typeName: string;
  subTypes: SubType[];
  phases: Phase[];
  records: Rec[];
  assets: Asset[];
  videoHref: string;
  inspectionHref?: string;
}) {
  const router = useRouter();

  const [subTypeId, setSubTypeId] = useState<string>(subTypes[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [editTarget, setEditTarget] = useState<{ phaseId: string; file: File } | null>(null);
  const [step, setStep] = useState(0); // 현재 단계 탭 인덱스
  const [editing, setEditing] = useState(true); // 텍스트 기록 작성 모드 (기본 열림)
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [mapCapturing, setMapCapturing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    textDescription: "",
    inspectionContent: "",
    partFromMain: "",
    partFromSub: "",
    partToMain: "",
    partToSub: "",
    notApplicable: false,
    notApplicableReason: "",
    lat: null as number | null,
    lng: null as number | null,
    address: "",
  });

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    records.filter((r) => r.subTypeId === subTypeId).forEach((r) => r.inspectionDate && set.add(r.inspectionDate));
    assets.filter((a) => a.subTypeId === subTypeId).forEach((a) => a.inspectionDate && set.add(a.inspectionDate));
    return set;
  }, [records, assets, subTypeId]);

  const submittedDates = useMemo(() => {
    const set = new Set<string>();
    records
      .filter((r) => r.subTypeId === subTypeId && r.status === "submitted")
      .forEach((r) => r.inspectionDate && set.add(r.inspectionDate));
    return set;
  }, [records, subTypeId]);

  const recMap = new Map<string, Rec>();
  records
    .filter((r) => r.subTypeId === subTypeId && (r.inspectionDate || "") === selectedDate)
    .forEach((r) => recMap.set(r.phaseTemplateId, r));
  const assetMap = new Map<string, Asset[]>();
  assets
    .filter((a) => a.subTypeId === subTypeId && (a.inspectionDate || "") === selectedDate)
    .forEach((a) => {
      const arr = assetMap.get(a.phaseTemplateId) || [];
      arr.push(a);
      assetMap.set(a.phaseTemplateId, arr);
    });

  const submittedCurrent = Array.from(recMap.values()).some((r) => r.status === "submitted");
  const hasCurrent = recMap.size > 0 || assetMap.size > 0;

  async function submitInspection(action: "submit" | "cancel") {
    if (action === "submit") setConsentOpen(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/records/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteStructureId, subTypeId, inspectionDate: selectedDate, action }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        alert(data.error || ("처리 실패 (" + res.status + ")"));
        return;
      }
      if (action === "submit" && videoHref) {
        // 제출 완료 -> 영상 미리보기로 이동하여 자동 생성·드라이브 저장
        router.push(`${videoHref}?date=${encodeURIComponent(selectedDate)}&autosave=1`);
        return;
      }
      router.refresh();
    } catch (e) {
      alert("처리 중 오류: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setSubmitting(false);
    }
  }

  function resetTransient() {
    setEditing(true);
    setGuideOpen(false);
    setError("");
  }
  function changeSubType(id: string) {
    setSubTypeId(id);
    setStep(0);
    resetTransient();
  }
  function changeDate(d: string) {
    setSelectedDate(d);
    setStep(0);
    resetTransient();
  }
  function goStep(idx: number) {
    setStep(Math.min(Math.max(idx, 0), phases.length - 1));
    resetTransient();
  }

  // 검측 위치 지도(VWorld 캡처)를 map 타입으로 백그라운드 업로드
  const lastMapRef = useRef<string>("");
  async function uploadMapImage(dataUrl: string) {
    if (!dataUrl || dataUrl === lastMapRef.current) return;
    lastMapRef.current = dataUrl;
    const f1 = phases[0];
    if (!f1) return;
    setMapCapturing(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "location-map.png", { type: "image/png" });
      const fd = new FormData();
      fd.append("siteStructureId", siteStructureId);
      fd.append("subTypeId", subTypeId);
      fd.append("phaseTemplateId", f1.id);
      fd.append("inspectionDate", selectedDate);
      fd.append("assetType", "map");
      fd.append("file", file);
      await fetch("/api/records/assets", { method: "POST", body: fd });
      router.refresh();
    } catch {
      // 조용히 무시 (지도는 보조 자료)
    } finally {
      setMapCapturing(false);
    }
  }

  function openEdit(p: Phase) {
    const r = recMap.get(p.id);
    setForm({
      lat: r?.latitude ?? null,
      lng: r?.longitude ?? null,
      address: r?.locationAddress ?? "",
      textDescription: r?.textDescription ?? "",
      inspectionContent: r?.inspectionContent ?? "",
      partFromMain: r?.inspectionPartFromMain != null ? String(r.inspectionPartFromMain) : "",
      partFromSub: r?.inspectionPartFromSub != null ? String(r.inspectionPartFromSub) : "",
      partToMain: r?.inspectionPartToMain != null ? String(r.inspectionPartToMain) : "",
      partToSub: r?.inspectionPartToSub != null ? String(r.inspectionPartToSub) : "",
      notApplicable: r?.notApplicable ?? false,
      notApplicableReason: r?.notApplicableReason ?? "",
    });
    setError("");
    setEditing(true);
  }

  async function saveText(p: Phase, i: number) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteStructureId,
          subTypeId,
          phaseTemplateId: p.id,
          inspectionDate: selectedDate,
          latitude: i === 0 && typeof form.lat === "number" ? form.lat : null,
          longitude: i === 0 && typeof form.lng === "number" ? form.lng : null,
          locationAddress: i === 0 ? (form.address || null) : null,
          textDescription: form.textDescription,
          notApplicable: form.notApplicable,
          notApplicableReason: form.notApplicableReason,
          inspectionContent: i === 0 ? form.inspectionContent : null,
          inspectionPartFromMain: i === 0 && form.partFromMain !== "" ? Number(form.partFromMain) : null,
          inspectionPartFromSub: i === 0 && form.partFromSub !== "" ? Number(form.partFromSub) : null,
          inspectionPartToMain: i === 0 && form.partToMain !== "" ? Number(form.partToMain) : null,
          inspectionPartToSub: i === 0 && form.partToSub !== "" ? Number(form.partToSub) : null,
        }),
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
      setEditing(true);
      router.refresh();
    } catch (e) {
      setError("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setLoading(false);
    }
  }

  async function resetPhase(p: Phase) {
    if (!confirm(`'${p.name}' 단계의 기록과 첨부 파일을 모두 삭제하고 초기화할까요?`)) return;
    try {
      const res = await fetch("/api/records/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteStructureId, subTypeId, phaseTemplateId: p.id, inspectionDate: selectedDate }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        alert(data.error || "초기화 실패");
        return;
      }
      router.refresh();
    } catch {
      alert("초기화 중 오류가 발생했습니다.");
    }
  }

  async function upload(phaseId: string, assetType: "photo" | "video", file: File) {
    setBusy(phaseId);
    try {
      const fd = new FormData();
      fd.append("siteStructureId", siteStructureId);
      fd.append("subTypeId", subTypeId);
      fd.append("phaseTemplateId", phaseId);
      fd.append("inspectionDate", selectedDate);
      fd.append("assetType", assetType);
      fd.append("file", file);
      const res = await fetch("/api/records/assets", { method: "POST", body: fd });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        alert(data.error || ("업로드 실패 (" + res.status + ")"));
        return;
      }
      router.refresh();
    } catch (e) {
      alert("업로드 중 오류: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setBusy(null);
    }
  }

  async function removeAsset(id: string) {
    if (!confirm("이 파일을 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
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

  const taCls =
    "min-h-[80px] w-full rounded-md border border-neutral-300 bg-white p-2 text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";
  const inpCls =
    "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";
  const numCls =
    "h-11 w-16 rounded-md border border-neutral-300 bg-white text-center text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";
  const uploadBtn =
    "inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0033A0] hover:bg-neutral-50";

  function phaseDone(p: Phase) {
    const r = recMap.get(p.id);
    const list = assetMap.get(p.id) || [];
    return !!r || list.length > 0;
  }
  function statusBadge(r: Rec | undefined) {
    if (!r) return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">미작성</span>;
    if (r.notApplicable) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">해당없음</span>;
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">기록됨</span>;
  }

  const p = phases[step];
  const r = p ? recMap.get(p.id) : undefined;
  const list = p ? assetMap.get(p.id) || [] : [];
  const photos = list.filter((a) => a.assetType === "photo");
  const videos = list.filter((a) => a.assetType === "video");
  const uploading = p ? busy === p.id : false;
  const isLast = step === phases.length - 1;

  return (
    <div className="space-y-4 pb-4">
      {editTarget && (
        <PhotoEditor
          file={editTarget.file}
          onCancel={() => setEditTarget(null)}
          onDone={(edited) => {
            const t = editTarget;
            setEditTarget(null);
            if (t) upload(t.phaseId, "photo", edited);
          }}
        />
      )}
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#0033A0]">{structureName}</h1>
          <p className="text-sm text-neutral-500">{typeName} · 세부항목별 검측 기록</p>
        </div>
        {inspectionHref && (
          <Link
            href={inspectionHref}
            className="whitespace-nowrap rounded-md bg-[#002A80] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#001d5c]"
          >
            📋 검측 요청서
          </Link>
        )}
        <Link
          href={videoHref}
          className="whitespace-nowrap rounded-md bg-[#FE5000] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#E04800]"
        >
          ▶ 영상 미리보기
        </Link>
      </div>

      {subTypeId && (
        <>
          <Calendar selected={selectedDate} marked={markedDates} submitted={submittedDates} onSelect={changeDate} />
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => changeDate(addDays(selectedDate, -1))}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              ◀ 전날
            </button>
            <span className="min-w-[110px] text-center font-semibold text-[#0033A0]">{selectedDate}</span>
            <button
              type="button"
              onClick={() => changeDate(addDays(selectedDate, 1))}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              다음날 ▶
            </button>
          </div>
        </>
      )}

      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
        <Label>세부 항목 (공종)</Label>
        {subTypes.length === 0 ? (
          <p className="text-sm text-neutral-500">이 대분류에는 세부 항목이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeSubType(t.id)}
                className={
                  "rounded-full px-3 py-1.5 text-sm font-semibold " +
                  (t.id === subTypeId ? "bg-[#0033A0] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
                }
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!subTypeId ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          먼저 세부 항목을 선택하세요.
        </div>
      ) : phases.length === 0 || !p ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          단계 템플릿이 없습니다.
        </div>
      ) : (
        <>
          {/* 단계 탭 */}
          <div className="grid grid-cols-5 gap-1.5">
            {phases.map((ph, idx) => {
              const done = phaseDone(ph);
              const active = idx === step;
              return (
                <button
                  key={ph.id}
                  type="button"
                  onClick={() => goStep(idx)}
                  className={
                    "flex flex-col items-center gap-1.5 rounded-xl border px-0.5 py-2.5 text-center transition " +
                    (active
                      ? "border-[#0033A0] bg-[#0033A0] text-white shadow"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-[#0033A0]")
                  }
                >
                  <span
                    className={
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold " +
                      (active ? "bg-white text-[#0033A0]" : done ? "bg-green-500 text-white" : "bg-neutral-200 text-neutral-500")
                    }
                  >
                    {done && !active ? "✓" : idx + 1}
                  </span>
                  <span className="text-[13px] font-bold leading-tight break-keep">{ph.name}</span>
                </button>
              );
            })}
          </div>

          {/* 현재 단계 카드 */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0033A0] text-sm font-bold text-white">
                  {step + 1}
                </span>
                <span className="text-lg font-bold text-[#0A2540]">{p.name}</span>
              </div>
              {statusBadge(r)}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {step === 1 && (<span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">사진 {photos.length}</span>)}
              {step >= 1 && (<span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">영상 {videos.length}</span>)}
              {step === 1 && (<span className="rounded bg-[#EAF0FB] px-1.5 py-0.5 font-semibold text-[#0033A0]">설계도면 사진 또는 영상 첨부</span>)}
              {step === 2 && (<span className="rounded bg-[#EAF0FB] px-1.5 py-0.5 font-semibold text-[#0033A0]">검측 영상 첨부</span>)}
            </div>



            {/* 촬영 가이드 제거됨 (안내문구는 상단 뱃지로 대체) */}

            <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {step === 1 && (
                <label className={uploadBtn}>
                  📷 사진 추가
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setEditTarget({ phaseId: p.id, file: f });
                      e.target.value = "";
                    }}
                  />
                </label>
                )}
                {step >= 1 && (
                <label className={uploadBtn}>
                  🎬 영상 추가
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(p.id, "video", f);
                      e.target.value = "";
                    }}
                  />
                </label>
                )}
                {uploading && <span className="text-xs text-neutral-500">업로드 중...</span>}
              </div>

              {list.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {step === 1 && photos.map((a) => (
                    <div key={a.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/assets/${a.id}/raw`}
                        alt={a.fileName}
                        className="h-16 w-16 rounded-md border border-neutral-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAsset(a.id)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {step >= 1 && videos.map((a) => (
                    <div key={a.id} className="relative">
                      <a
                        href={`/api/assets/${a.id}/raw`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-16 w-16 flex-col items-center justify-center rounded-md border border-neutral-200 bg-neutral-900 text-white"
                      >
                        <span className="text-lg leading-none">▶</span>
                        <span className="mt-0.5 text-[9px]">영상</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAsset(a.id)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editing ? (
              <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.notApplicable}
                    onChange={(e) => setForm((f) => ({ ...f, notApplicable: e.target.checked }))}
                  />
                  이 단계는 해당 없음
                </label>
                {form.notApplicable ? (
                  <div className="space-y-1">
                    <Label>해당없음 사유</Label>
                    <textarea
                      className={taCls}
                      value={form.notApplicableReason}
                      onChange={(e) => setForm((f) => ({ ...f, notApplicableReason: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {step === 0 && (
                      <>
                        <div className="space-y-1">
                          <Label>검측내용</Label>
                          <input
                            className={inpCls}
                            value={form.inspectionContent}
                            onChange={(e) => setForm((f) => ({ ...f, inspectionContent: e.target.value }))}
                            placeholder="예: 00공사"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>검측부위</Label>
                          <div className="flex flex-wrap items-center gap-1 text-base">
                            <span className="font-semibold text-neutral-600">NO.</span>
                            <input
                              className={numCls}
                              inputMode="numeric"
                              value={form.partFromMain}
                              onChange={(e) => setForm((f) => ({ ...f, partFromMain: e.target.value.replace(/[^0-9]/g, "") }))}
                            />
                            <span className="font-semibold">+</span>
                            <input
                              className={numCls}
                              inputMode="numeric"
                              value={form.partFromSub}
                              onChange={(e) => setForm((f) => ({ ...f, partFromSub: e.target.value.replace(/[^0-9]/g, "") }))}
                            />
                            <span className="px-1 font-bold text-neutral-500">~</span>
                            <span className="font-semibold text-neutral-600">NO.</span>
                            <input
                              className={numCls}
                              inputMode="numeric"
                              value={form.partToMain}
                              onChange={(e) => setForm((f) => ({ ...f, partToMain: e.target.value.replace(/[^0-9]/g, "") }))}
                            />
                            <span className="font-semibold">+</span>
                            <input
                              className={numCls}
                              inputMode="numeric"
                              value={form.partToSub}
                              onChange={(e) => setForm((f) => ({ ...f, partToSub: e.target.value.replace(/[^0-9]/g, "") }))}
                            />
                          </div>
                          <p className="text-xs text-neutral-400">예: NO.0+00 ~ NO.0+00 (측점 구간)</p>
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      {step > 0 && <Label>설명내용</Label>}
{step === 0 && (
                        <div className="mb-3 space-y-1">
                          <Label>검측 위치 (지도)</Label>
                          <KakaoMapPicker
                            value={{ lat: form.lat, lng: form.lng, address: form.address }}
                            onChange={(v) => setForm((f) => ({ ...f, lat: v.lat, lng: v.lng, address: v.address }))}
                            onCapture={(dataUrl) => uploadMapImage(dataUrl)}
                          />
                          {mapCapturing && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#EAF0FB] px-3 py-2 text-sm text-[#0033A0]">
                              <span className="motion-safe:animate-pulse">📍</span>
                              <span className="font-semibold">주소를 추출하여 동영상에 입력중입니다…</span>
                            </div>
                          )}
                          <div className="mt-3 space-y-1">
                            <Label>검측 위치 (주소)</Label>
                            <Input
                              value={form.address}
                              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                              placeholder="지도를 클릭하거나 주소를 검색하면 자동 입력됩니다"
                            />
                          </div>
                        </div>
                      )}
                      {step > 0 && (
                      <AiWriteButton
                        assetIds={photos.map((a) => a.id)}
                        phaseName={p.name}
                        phaseCode={p.code}
                        structureTypeName={typeName}
                        subTypeName={subTypes.find((s) => s.id === subTypeId)?.name || ""}
                        subTypeId={subTypeId}
                        guideText={subTypes.find((s) => s.id === subTypeId)?.guideText || p.guideText || ""}
                        currentText={form.textDescription}
                        onApply={(t) => setForm((f) => ({ ...f, textDescription: t }))}
                      />
                      )}
                      {step > 0 && (
                      <textarea
                        className={taCls}
                        value={form.textDescription}
                        onChange={(e) => setForm((f) => ({ ...f, textDescription: e.target.value }))}
                      />
                      )}
                    </div>
                  </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                    취소
                  </Button>
                  <ActionButton className="flex-1" onClick={() => saveText(p, step)} disabled={loading}>
                    {loading ? "저장 중..." : "기록 저장"}
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                  {r ? "텍스트 기록 수정" : "텍스트 기록 작성"}
                </Button>
                {(r || list.length > 0) && (
                  <Button type="button" variant="outline" className="text-red-600" onClick={() => resetPhase(p)}>
                    초기화
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 단계 이동 */}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => goStep(step - 1)}
              disabled={step === 0}
              className="min-w-[96px]"
            >
              ◀ 이전 단계
            </Button>
            {!isLast ? (
              <ActionButton onClick={() => goStep(step + 1)} className="min-w-[96px]">
                다음 단계 ▶
              </ActionButton>
            ) : (
              <span className="text-sm font-semibold text-[#0033A0]">마지막 단계</span>
            )}
          </div>

          {/* 제출 영역 (마지막 단계 또는 기록 존재 시) */}
          {hasCurrent && (isLast || submittedCurrent) && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              {submittedCurrent ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-green-700">✓ 제출됨 ({selectedDate})</span>
                  <Button type="button" variant="outline" onClick={() => submitInspection("cancel")} disabled={submitting}>
                    {submitting ? "처리 중..." : "제출 취소"}
                  </Button>
                </div>
              ) : (
                <ActionButton className="w-full" onClick={() => setConsentOpen(true)} disabled={submitting}>
                  {submitting ? "제출 중..." : `이 검측일자(${selectedDate}) 제출`}
                </ActionButton>
              )}
            </div>
          )}
        </>
      )}
      {consentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConsentOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-center text-base font-bold text-[#002A80]">[ 검측 자료 등록 전 필수 확인 ]</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              시공사가 등록하는 본 영상·사진은 향후 시설물의 품질 보증 및 책임 시공을 증명하는 객관적 데이터베이스로 보관됩니다.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
              <li>영상 내/외의 모든 부실시공 및 시방서 미준수에 대한 책임</li>
              <li>현장 오인 유도, 영상 조작 및 은폐로 인한 문제 발생 시 책임</li>
              <li>영상에 담기지 않은 사각지대의 구조적 결함에 대한 책임</li>
            </ol>
            <p className="mt-3 rounded-md bg-neutral-50 p-2.5 text-xs leading-relaxed text-neutral-600">
              본 영상의 등록으로 발생하는 시설물의 품질·안전 및 법적 책임은 전적으로 시공사에 있으며, 발주청은 사후 검증 및 원인 규명을 위한 데이터 보관 역할만을 수행합니다.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConsentOpen(false)}
                className="flex-1 rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => submitInspection("submit")}
                disabled={submitting}
                className="flex-1 rounded-md bg-[#002A80] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "제출 중..." : "확인했으며, 동의 후 제출합니다"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
