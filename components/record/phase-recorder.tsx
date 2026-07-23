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
  requests = [],
  inspectionBaseHref,
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
  requests?: { id: string; subTypeId: string | null; inspectionDate: string | null; status: string }[];
  inspectionBaseHref?: string;
}) {
  const router = useRouter();

  const [subTypeId, setSubTypeId] = useState<string>(subTypes[0]?.id || "");
  // 캘린더 조회 필터 ("" = 전체보기) — 입력용 세부항목(subTypeId) 과 분리
  const [calFilter, setCalFilter] = useState<string>("");
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
    records.filter((r) => !calFilter || r.subTypeId === calFilter).forEach((r) => r.inspectionDate && set.add(r.inspectionDate));
    assets.filter((a) => !calFilter || a.subTypeId === calFilter).forEach((a) => a.inspectionDate && set.add(a.inspectionDate));
    return set;
  }, [records, assets, calFilter]);

  const submittedDates = useMemo(() => {
    const set = new Set<string>();
    records
      .filter((r) => (!calFilter || r.subTypeId === calFilter) && r.status === "submitted")
      .forEach((r) => r.inspectionDate && set.add(r.inspectionDate));
    return set;
  }, [records, calFilter]);

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
  // 발주처/감독: 선택 날짜+공종의 검측요청서
  const currentRequest = requests.find(
    (q) => q.inspectionDate === selectedDate && (q.subTypeId || "") === (subTypeId || "")
  );

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

  async function deleteDayRecord() {
    if (!selectedDate || !subTypeId) return;
    if (
      !window.confirm(
        `${selectedDate} 의 모든 공종 검측기록(공종종류·설계도면·세부촬영)과 첨부 사진·영상을 삭제합니다.\n제출완료된 기록도 함께 삭제됩니다. 되돌릴 수 없습니다. 계속할까요?`
      )
    )
      return;
    setSubmitting(true);
    // 삭제 시작: 자동저장 차단 + 대기 중 타이머 취소
    deletingRef.current = true;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    try {
      const res = await fetch("/api/records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteStructureId, subTypeId, inspectionDate: selectedDate, allSubTypes: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "삭제에 실패했습니다.");
        deletingRef.current = false; // 실패 시 자동저장 재허용
        return;
      }
      // 화면 초기화 + 갱신 — 삭제한 날짜·공종의 모든 단계 캐시 제거 (되살아남 방지)
      loadKeyRef.current = "";
      // 그 날짜의 모든 공종·단계 캐시 제거 (날짜 전체 삭제이므로)
      for (const _t of subTypes) {
        for (let _i = 0; _i < phases.length; _i++) {
          savedFormsRef.current.delete(`${_i}|${selectedDate}|${_t.id}`);
        }
      }
      // 폼도 즉시 비워 캐시 재기록 방지
      setForm({
        lat: null,
        lng: null,
        address: "",
        textDescription: "",
        inspectionContent: "",
        partFromMain: "",
        partFromSub: "",
        partToMain: "",
        partToSub: "",
        notApplicable: false,
        notApplicableReason: "",
      });
      setStep(0);
      justLoadedRef.current = true; // 삭제 후 첫 로드가 자동저장을 유발하지 않도록
      router.refresh();
      // refresh 로 새 records 가 반영된 뒤 자동저장 재허용
      setTimeout(() => {
        deletingRef.current = false;
      }, 1500);
    } catch (e) {
      setError("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
      deletingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }
  function resetTransient() {
    setEditing(true);
    setGuideOpen(false);
    setError("");
    // 날짜/공종/단계 전환 시 지도 캡처 플래그 초기화
    mapDirtyRef.current = false;
  }
  // 단계/날짜/세부항목을 옮기기 전에 대기 중인 자동저장을 즉시 실행
  function flushSave() {
    const cur = phases[step];
    if (!cur || !selectedDate || !subTypeId) return;
    const hasContent =
      !!form.textDescription ||
      !!form.inspectionContent ||
      form.lat != null ||
      !!form.address ||
      form.partFromMain !== "" ||
      form.partFromSub !== "" ||
      form.partToMain !== "" ||
      form.partToSub !== "";
    if (!hasContent) return;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    // 저장은 백그라운드로 진행 - 화면 전환을 막지 않음
    void saveText(cur, step, true);
  }
  function changeSubType(id: string) {
    flushSave();
    setSubTypeId(id);
    setStep(0);
    resetTransient();
  }
  function changeDate(d: string) {
    flushSave();
    setSelectedDate(d);
    setStep(0);
    resetTransient();
  }
  function goStep(idx: number) {
    flushSave();
    setStep(Math.min(Math.max(idx, 0), phases.length - 1));
    resetTransient();
  }

  // 영상 화면 등에 다녀와서 돌아오면(뒤로가기 포함) 최신 기록/제출상태로 자동 갱신
  const didInitRefresh = useRef(false);
  useEffect(() => {
    if (!didInitRefresh.current) {
      didInitRefresh.current = true;
      router.refresh();
    }
    const onShow = () => router.refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 보던 세부항목/검측일자 기억 (영상 화면 등에 다녀와도 그대로 복원)
  const stateKey = `krc:rec:${siteStructureId}`;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(stateKey);
      if (!raw) return;
      const v = JSON.parse(raw) as { date?: string; subTypeId?: string };
      if (v.subTypeId && subTypes.some((s) => s.id === v.subTypeId)) setSubTypeId(v.subTypeId);
      if (v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) setSelectedDate(v.date);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(stateKey, JSON.stringify({ date: selectedDate, subTypeId }));
    } catch {
      // ignore
    }
  }, [stateKey, selectedDate, subTypeId]);

  // 검측 위치 지도(VWorld 캡처)를 map 타입으로 백그라운드 업로드
  const lastMapRef = useRef<string>("");
  // 사용자가 지도를 직접 클릭/검색해 위치를 지정했을 때만 true (조회만 할 땐 캡처 안 함)
  const mapDirtyRef = useRef(false);
  async function uploadMapImage(dataUrl: string) {
    // 조회만 할 때(저장된 기록 열람)는 캡처하지 않음 — 사용자가 위치를 새로 지정한 경우만
    if (!mapDirtyRef.current) return;
    // 이미 제출된 검측일자는 지도 갱신 안 함
    if (submittedCurrent) return;
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
      await fetch("/api/records/assets", { method: "POST", body: fd, headers: { "x-silent": "1" } });
      mapDirtyRef.current = false;
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

  // 단계/날짜/세부항목 "전환 시에만" 저장된 기록을 form 에 로드 (records 갱신에는 반응 안 함 -> 입력 안 덮어씀)
  const loadKeyRef = useRef<string>("");
  const justLoadedRef = useRef<boolean>(false);
  // 삭제 진행 중 플래그 - 삭제 직후 자동저장이 기록을 재생성하는 것을 차단
  const deletingRef = useRef<boolean>(false);
  // 저장한 값을 메모리에 캐시 - 서버 갱신이 늦어도 단계 복귀 시 입력값 유지
  const savedFormsRef = useRef<Map<string, typeof form>>(new Map());
  useEffect(() => {
    const cur = phases[step];
    if (!cur) return;
    const key = `${step}|${selectedDate}|${subTypeId}`;
    if (loadKeyRef.current === key) return; // 같은 단계에서 records 만 갱신된 경우: 로드 스킵
    loadKeyRef.current = key;
    const rec = recMap.get(cur.id);
    justLoadedRef.current = true; // 로드 직후 자동저장 1회 스킵
    const cached = savedFormsRef.current.get(key);
    if (cached) {
      // 이 세션에서 저장한 값이 있으면 우선 사용 (서버 갱신 지연 대비)
      setForm(cached);
      setError("");
      setEditing(true);
      return;
    }
    setForm({
      lat: rec?.latitude ?? null,
      lng: rec?.longitude ?? null,
      address: rec?.locationAddress ?? "",
      textDescription: rec?.textDescription ?? "",
      inspectionContent: rec?.inspectionContent ?? "",
      partFromMain: rec?.inspectionPartFromMain != null ? String(rec.inspectionPartFromMain) : "",
      partFromSub: rec?.inspectionPartFromSub != null ? String(rec.inspectionPartFromSub) : "",
      partToMain: rec?.inspectionPartToMain != null ? String(rec.inspectionPartToMain) : "",
      partToSub: rec?.inspectionPartToSub != null ? String(rec.inspectionPartToSub) : "",
      notApplicable: rec?.notApplicable ?? false,
      notApplicableReason: rec?.notApplicableReason ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedDate, subTypeId]);

  // 자동저장: form 이 바뀌면 1.5초 후 자동으로 저장 (기록저장 버튼 없이도)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (deletingRef.current) return; // 삭제 중에는 자동저장 금지 (재생성 방지)
    if (justLoadedRef.current) {
      justLoadedRef.current = false; // 로드로 인한 변경은 저장 안 함
      return;
    }
    const cur = phases[step];
    if (!cur || !selectedDate || !subTypeId) return;
    // 내용이 아무것도 없으면 저장 안 함
    const hasContent =
      !!form.textDescription ||
      !!form.inspectionContent ||
      form.lat != null ||
      !!form.address ||
      form.partFromMain !== "" ||
      form.notApplicable;
    if (!hasContent) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveText(cur, step, true); // silent 저장
    }, 1500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  async function saveText(p: Phase, i: number, silent: boolean = false) {
    if (deletingRef.current) return; // 삭제 중에는 저장 금지 (재생성 방지)
    if (!silent) {
      setError("");
      setLoading(true);
    }
    try {
      // 저장 값을 캐시에 기록 (백그라운드 저장 중 단계 이동해도 값 유지)
      savedFormsRef.current.set(`${i}|${selectedDate}|${subTypeId}`, form);
      const res = await fetch("/api/records", {
        method: "POST",
        headers: silent
          ? { "Content-Type": "application/json", "x-silent": "1" }
          : { "Content-Type": "application/json" },
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
        // 자동저장 실패도 화면에 표시 (조용히 사라지는 것 방지)
        setError((silent ? "⚠ 자동 저장 실패: " : "") + (data.error || ("서버 오류 (" + res.status + ")")));
        return;
      }
      setEditing(true);
      setError("");
      // 저장 후 항상 최신 기록으로 갱신 (form 은 단계 전환 시에만 로드하므로 입력값은 유지됨)
      router.refresh();
    } catch (e) {
      setError((silent ? "⚠ 자동 저장 실패: " : "") + "요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      if (!silent) setLoading(false);
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
        {/* 상단 검측 요청서 버튼 제거 — 하단 제출 옆 [📋 검측요청서] 사용 */}
        <Link
          href={videoHref}
          className="whitespace-nowrap rounded-md bg-[#FE5000] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#E04800]"
        >
          ▶ 영상 미리보기
        </Link>
      </div>

      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
        <Label>캘린더 조회 (공종별)</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCalFilter("")}
            className={
              "rounded-full px-3 py-1.5 text-sm font-semibold " +
              (calFilter === "" ? "bg-[#FE5000] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
            }
          >
            전체보기
          </button>
          {subTypes.map((t) => (
            <button
              key={"cal-" + t.id}
              type="button"
              onClick={() => setCalFilter(t.id)}
              className={
                "rounded-full px-3 py-1.5 text-sm font-semibold " +
                (calFilter === t.id ? "bg-[#0033A0] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
              }
            >
              {t.name}
            </button>
          ))}
        </div>
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

      {/* 상단 세부항목 탭 제거 — F1 카드 안에서 선택 */}

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
              <div className="mt-3 space-y-3 pt-1">
                  <div className="space-y-3">
                    {step === 0 && (
                      <>
                        <div className="space-y-1">
                          <Label>세부 항목 (공종)</Label>
                          <div className="flex flex-wrap gap-2">
                            {subTypes.map((t) => (
                              <button
                                key={"f1-" + t.id}
                                type="button"
                                onClick={() => changeSubType(t.id)}
                                className={
                                  "rounded-full px-3 py-1.5 text-sm font-semibold " +
                                  (t.id === subTypeId
                                    ? "bg-[#0033A0] text-white"
                                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
                                }
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
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
                      {step > 0 && (
                        <div>
                          <Label>설명내용</Label>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#0033A0]">
                            오늘 검측이 필요한 내용들을 적어주세요
                            <br />
                            <span className="text-neutral-500">(예시: 겹이음 00cm, 모래 포설 00cm, 터파기 사면 1:1.2 등)</span>
                          </p>
                        </div>
                      )}
{step === 0 && (
                        <div className="mb-3 space-y-1">
                          <Label>검측 위치 (지도)</Label>
                          <KakaoMapPicker
                            value={{ lat: form.lat, lng: form.lng, address: form.address }}
                            onChange={(v) => {
                              mapDirtyRef.current = true;
                              setForm((f) => ({ ...f, lat: v.lat, lng: v.lng, address: v.address }));
                            }}
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
                {error && <p className="text-sm text-red-600">{error}</p>}
                <p className="text-xs text-neutral-400">
                  {loading ? "저장 중..." : "입력한 내용은 자동으로 저장됩니다"}
                </p>
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
                <div className="space-y-3">
                  <span className="block font-semibold text-green-700">✓ 제출됨 ({selectedDate})</span>
                  <div className="flex flex-wrap gap-2">
                    {inspectionHref && (
                      <Link
                        href={`${inspectionHref}?date=${encodeURIComponent(selectedDate)}&sub=${encodeURIComponent(subTypeId)}&auto=1`}
                        className="whitespace-nowrap rounded-md bg-[#002A80] px-3 py-2 text-sm font-semibold text-white"
                      >
                        📋 검측요청서
                      </Link>
                    )}
                    {inspectionBaseHref && currentRequest && (
                      <Link
                        href={`${inspectionBaseHref}/${currentRequest.id}`}
                        className={
                          "whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-white " +
                          (currentRequest.status === "approved" ? "bg-emerald-600" : "bg-[#002A80]")
                        }
                      >
                        {currentRequest.status === "approved" ? "📄 검측결과서 확인하기" : "📋 검측요청서 확인하기"}
                      </Link>
                    )}
                    {inspectionBaseHref && !currentRequest && (
                      <span className="whitespace-nowrap rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
                        검측요청서가 아직 제출되지 않았습니다
                      </span>
                    )}
                    <Button type="button" variant="outline" onClick={() => submitInspection("cancel")} disabled={submitting}>
                      {submitting ? "처리 중..." : "제출 취소"}
                    </Button>
                    <button
                      type="button"
                      onClick={deleteDayRecord}
                      disabled={submitting}
                      className="whitespace-nowrap rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      🗑 삭제
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <ActionButton className="flex-1" onClick={() => setConsentOpen(true)} disabled={submitting}>
                    {submitting ? "제출 중..." : `이 검측일자(${selectedDate}) 제출`}
                  </ActionButton>
                  {inspectionHref && (
                    <Link
                      href={`${inspectionHref}?date=${encodeURIComponent(selectedDate)}&sub=${encodeURIComponent(subTypeId)}&auto=1`}
                      className="flex items-center whitespace-nowrap rounded-md bg-[#002A80] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      📋 검측요청서
                    </Link>
                  )}
                  {inspectionBaseHref && currentRequest && (
                    <Link
                      href={`${inspectionBaseHref}/${currentRequest.id}`}
                      className={
                        "flex items-center whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold text-white " +
                        (currentRequest.status === "approved" ? "bg-emerald-600" : "bg-[#002A80]")
                      }
                    >
                      {currentRequest.status === "approved" ? "📄 검측결과서 확인하기" : "📋 검측요청서 확인하기"}
                    </Link>
                  )}
                  {inspectionBaseHref && !currentRequest && (
                    <span className="flex items-center whitespace-nowrap rounded-md bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500">
                      검측요청서가 아직 제출되지 않았습니다
                    </span>
                  )}
                  {hasCurrent && (
                    <button
                      type="button"
                      onClick={deleteDayRecord}
                      disabled={submitting}
                      className="flex items-center whitespace-nowrap rounded-md border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      🗑 삭제
                    </button>
                  )}
                </div>
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
