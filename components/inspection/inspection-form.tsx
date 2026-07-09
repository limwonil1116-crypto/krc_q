"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SubType = { id: string; name: string };
type Supervisor = { id: string; name: string; branch: string | null };
type Rec = {
  phaseTemplateId: string;
  subTypeId: string | null;
  inspectionDate: string | null;
  inspectionContent: string | null;
  inspectionPartFromMain: number | null;
  inspectionPartFromSub: number | null;
  inspectionPartToMain: number | null;
  inspectionPartToSub: number | null;
  locationAddress: string | null;
};
type AssetRow = { inspectionDate: string | null; subTypeId: string | null; assetType: string };
type ReqRow = { id: string; inspectionDate: string | null; inspectionMatter: string | null; status: string };
type Site = { projectName: string; districtName: string; address: string; contractorCompany: string | null } | null;

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  submitted: "제출됨(감독 대기)",
  under_review: "감독 검토중",
  revision_requested: "재검측 요청",
  approved: "승인 완료",
};

function partText(r: Rec): string {
  const pf =
    r.inspectionPartFromMain != null || r.inspectionPartFromSub != null
      ? `NO.${r.inspectionPartFromMain ?? 0}+${String(r.inspectionPartFromSub ?? 0).padStart(2, "0")}`
      : "";
  const pt =
    r.inspectionPartToMain != null || r.inspectionPartToSub != null
      ? `NO.${r.inspectionPartToMain ?? 0}+${String(r.inspectionPartToSub ?? 0).padStart(2, "0")}`
      : "";
  return pf && pt ? `${pf} ~ ${pt}` : pf || pt || "";
}

export function InspectionForm({
  siteId,
  siteStructureId,
  structureName,
  typeName,
  site,
  subTypes,
  supervisors,
  records,
  assets,
  existingRequests,
  initialDate,
  initialReqId,
  backHref,
}: {
  siteId: string;
  siteStructureId: string;
  structureName: string;
  typeName: string;
  site: Site;
  subTypes: SubType[];
  supervisors: Supervisor[];
  records: Rec[];
  assets: AssetRow[];
  existingRequests: ReqRow[];
  initialDate: string;
  initialReqId: string;
  backHref: string;
}) {
  const router = useRouter();

  // 날짜 목록 (기존 검측기록에서)
  const dates = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => r.inspectionDate && s.add(r.inspectionDate));
    return Array.from(s).sort().reverse();
  }, [records]);

  const [selectedDate, setSelectedDate] = useState(initialDate || dates[0] || "");
  const [subTypeId, setSubTypeId] = useState("");
  const [form, setForm] = useState({
    locationWork: typeName || "",
    inspectionPart: "",
    inspectionMatter: "",
    requestNo: "",
    contractorAgentName: "",
    contractorCheckerName: "",
    supervisorId: "",
    isRecheck: false,
  });
  const [busy, setBusy] = useState(false);

  // 선택 날짜의 검측기록에서 위치·부위·내용 자동 연계
  const dayRec = useMemo(
    () => records.find((r) => r.inspectionDate === selectedDate && (!subTypeId || r.subTypeId === subTypeId)),
    [records, selectedDate, subTypeId]
  );

  function autofillFromRecord() {
    if (!dayRec) return;
    setForm((f) => ({
      ...f,
      inspectionPart: partText(dayRec) || f.inspectionPart,
      inspectionMatter: dayRec.inspectionContent || f.inspectionMatter,
    }));
  }

  // 선택 날짜의 자료 개수
  const dayAssets = useMemo(() => {
    const a = assets.filter((x) => x.inspectionDate === selectedDate);
    return {
      photo: a.filter((x) => x.assetType === "photo").length,
      video: a.filter((x) => x.assetType === "video").length,
      map: a.filter((x) => x.assetType === "map").length,
      doc: a.filter((x) => x.assetType === "document").length,
    };
  }, [assets, selectedDate]);

  async function saveDraft() {
    setBusy(true);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteStructureId,
          subTypeId: subTypeId || null,
          inspectionDate: selectedDate,
          requestNo: form.requestNo,
          locationWork: form.locationWork,
          inspectionPart: form.inspectionPart,
          inspectionMatter: form.inspectionMatter,
          isRecheck: form.isRecheck,
          contractorAgentName: form.contractorAgentName,
          contractorCheckerName: form.contractorCheckerName,
          supervisorId: form.supervisorId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "저장 실패");
        return;
      }
      alert("임시 저장되었습니다.");
      router.refresh();
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#002A80] focus:outline-none";
  const labelCls = "block text-sm font-semibold text-neutral-700 mb-1";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#002A80]">검측 요청서</h1>
          <p className="text-sm text-neutral-500">
            {structureName} · {typeName}
          </p>
        </div>
        <Link href={backHref} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
          ← 돌아가기
        </Link>
      </div>

      {/* 기존 요청서 목록 */}
      {existingRequests.length > 0 && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-xs font-semibold text-neutral-600">기존 검측 요청</p>
          <div className="space-y-1">
            {existingRequests.map((r) => (
              <Link
                key={r.id}
                href={`/contractor/sites/${siteId}/structures/${siteStructureId}/inspection?reqId=${r.id}`}
                className="flex items-center justify-between rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm hover:bg-neutral-50"
              >
                <span>
                  {r.inspectionDate} · {r.inspectionMatter || "(제목없음)"}
                </span>
                <span className="rounded bg-[#002A80]/10 px-1.5 py-0.5 text-xs text-[#002A80]">
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        {/* 날짜 + 세부공종 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>검측일자</label>
            {dates.length > 0 ? (
              <select className={inputCls} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
                <option value="">선택</option>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <input type="date" className={inputCls} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            )}
          </div>
          <div>
            <label className={labelCls}>세부공종</label>
            <select className={inputCls} value={subTypeId} onChange={(e) => setSubTypeId(e.target.value)}>
              <option value="">전체</option>
              {subTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 자료 연계 현황 */}
        <div className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-600">
          연계 자료: 사진 {dayAssets.photo} · 영상 {dayAssets.video} · 지도 {dayAssets.map} · 도면 {dayAssets.doc}
          {dayRec && (
            <button type="button" onClick={autofillFromRecord} className="ml-2 rounded bg-[#002A80] px-2 py-0.5 text-white">
              검측기록 자동채움
            </button>
          )}
        </div>

        {/* 요청서 필드 */}
        <div>
          <label className={labelCls}>위치 및 공종</label>
          <input className={inputCls} value={form.locationWork} onChange={(e) => setForm((f) => ({ ...f, locationWork: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>검측 부위</label>
          <input className={inputCls} value={form.inspectionPart} onChange={(e) => setForm((f) => ({ ...f, inspectionPart: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>검측 사항</label>
          <input
            className={inputCls}
            value={form.inspectionMatter}
            onChange={(e) => setForm((f) => ({ ...f, inspectionMatter: e.target.value }))}
            placeholder="예: 구조물터파기"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>점검 직원</label>
            <input className={inputCls} value={form.contractorCheckerName} onChange={(e) => setForm((f) => ({ ...f, contractorCheckerName: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>현장대리인</label>
            <input className={inputCls} value={form.contractorAgentName} onChange={(e) => setForm((f) => ({ ...f, contractorAgentName: e.target.value }))} />
          </div>
        </div>

        {/* 공사감독원 지정 */}
        <div>
          <label className={labelCls}>공사감독원 지정</label>
          <select className={inputCls} value={form.supervisorId} onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}>
            <option value="">선택하세요</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.branch ? `(${s.branch})` : ""}
              </option>
            ))}
          </select>
          {supervisors.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">이 현장에 등록된 공사감독원이 없습니다.</p>
          )}
        </div>

        {/* AI 체크리스트 자리 (3-3 에서 채움) */}
        <div className="rounded-md border border-dashed border-neutral-300 p-3 text-center text-sm text-neutral-400">
          체크리스트 (다음 단계에서 추가)
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveDraft}
            disabled={busy || !selectedDate}
            className="flex-1 rounded-md bg-[#002A80] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "저장 중..." : "임시 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
