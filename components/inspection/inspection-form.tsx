"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/inspection/signature-pad";
import { InspectionPdfButton } from "@/components/inspection/inspection-pdf-button";

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
  initialSubTypeId,
  autoFill,
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
  initialSubTypeId?: string;
  autoFill?: boolean;
}) {
  const router = useRouter();

  // 날짜 목록 (기존 검측기록에서)
  const dates = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => r.inspectionDate && s.add(r.inspectionDate));
    return Array.from(s).sort().reverse();
  }, [records]);

  const [selectedDate, setSelectedDate] = useState(initialDate || dates[0] || "");
  const [subTypeId, setSubTypeId] = useState(initialSubTypeId || "");
  const [form, setForm] = useState({
    locationWork: typeName || "",
    inspectionPart: "",
    inspectionMatter: "",
    requestNo: "",
    contractorAgentName: "",
    contractorCheckerName: "",
    contractorSignature: "",
    supervisorId: "",
    isRecheck: false,
  });
  const [busy, setBusy] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  // 제출 전 검증 -> 통과하면 책임고지 모달 열기
  function tryOpenConsent() {
    if (!selectedDate) {
      alert("검측일자를 선택하세요.");
      return;
    }
    if (!form.contractorSignature) {
      alert("제출하려면 현장대리인 서명이 필요합니다.");
      return;
    }
    if (!form.supervisorId) {
      alert("제출하려면 공사감독원을 지정하세요.");
      return;
    }
    if (items.length === 0) {
      alert("체크리스트 항목을 먼저 작성하세요.");
      return;
    }
    setShowConsent(true);
  }

  // 체크리스트 항목 (시공자 1차 체크)
  type ClItem = { checkItem: string; standard: string; contractorResult: string; contractorNote: string };
  const [items, setItems] = useState<ClItem[]>([]);
  const [aiBusy, setAiBusy] = useState(false);

  const subTypeName = useMemo(
    () => subTypes.find((s) => s.id === subTypeId)?.name || "",
    [subTypes, subTypeId]
  );

  async function generateChecklist() {
    const work = form.inspectionMatter || subTypeName || typeName;
    if (!work) {
      alert("검측 사항 또는 세부공종을 먼저 입력/선택하세요.");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workName: work,
          subTypeName,
          subTypeId: subTypeId || "",
          context: form.inspectionPart ? `검측부위: ${form.inspectionPart}` : "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || "체크리스트 생성 실패");
        return;
      }
      const gen: ClItem[] = (data.items || []).map((x: { check_item: string; standard: string }) => ({
        checkItem: x.check_item,
        standard: x.standard || "",
        contractorResult: "",
        contractorNote: "",
      }));
      setItems(gen);
    } catch {
      alert("체크리스트 생성 중 오류가 발생했습니다.");
    } finally {
      setAiBusy(false);
    }
  }

  function setItem(idx: number, patch: Partial<ClItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((arr) => [...arr, { checkItem: "", standard: "", contractorResult: "", contractorNote: "" }]);
  }
  function removeItem(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }

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

  // 검측기록 화면의 [검측요청서] 로 들어온 경우: 기록 자동채움 + AI 체크리스트 자동 생성
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!autoFill || autoRanRef.current || !dayRec) return;
    autoRanRef.current = true;
    const part = partText(dayRec) || "";
    const matter = dayRec.inspectionContent || "";
    setForm((f) => ({
      ...f,
      locationWork: f.locationWork || subTypeName || structureName,
      inspectionPart: part || f.inspectionPart,
      inspectionMatter: matter || f.inspectionMatter,
    }));
    const work = matter || subTypeName || typeName;
    if (!work) return;
    (async () => {
      setAiBusy(true);
      try {
        const res = await fetch("/api/ai/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workName: work,
            subTypeName,
            subTypeId: subTypeId || "",
            context: part ? `검측부위: ${part}` : "",
          }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setItems(
            (data.items || []).map((x: { check_item: string; standard: string }) => ({
              checkItem: x.check_item,
              standard: x.standard || "",
              contractorResult: "",
              contractorNote: "",
            }))
          );
        }
      } catch {
        // ignore
      } finally {
        setAiBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFill, dayRec]);

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

  async function saveDraft(submit = false) {
    if (submit) {
      if (!form.supervisorId) {
        alert("제출하려면 공사감독원을 지정하세요.");
        return;
      }
      if (items.length === 0) {
        alert("체크리스트 항목을 먼저 작성하세요.");
        return;
      }
    }
    setShowConsent(false);
    setBusy(true);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteStructureId,
          submit,
          subTypeId: subTypeId || null,
          inspectionDate: selectedDate,
          requestNo: form.requestNo,
          locationWork: form.locationWork,
          inspectionPart: form.inspectionPart,
          inspectionMatter: form.inspectionMatter,
          isRecheck: form.isRecheck,
          contractorAgentName: form.contractorAgentName,
          contractorCheckerName: form.contractorCheckerName,
          contractorSignature: form.contractorSignature || null,
          supervisorId: form.supervisorId || null,
          checklists: [
            {
              facilityName: structureName,
              locationPart: form.inspectionPart,
              workName: subTypeName || typeName,
              quantity: "",
              stage: "",
              aiGenerated: items.length > 0,
              items: items.map((it, i) => ({
                itemNo: i + 1,
                checkItem: it.checkItem,
                standard: it.standard,
                contractorResult: it.contractorResult,
                contractorNote: it.contractorNote,
              })),
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "저장 실패");
        return;
      }
      alert(submit ? "제출되었습니다." : "임시 저장되었습니다.");
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

        {/* 현장대리인 서명 (제출 필수) */}
        <div>
          <label className={labelCls}>현장대리인 서명 *</label>
          <SignaturePad
            value={form.contractorSignature}
            onChange={(v) => setForm((f) => ({ ...f, contractorSignature: v || "" }))}
            label="현장대리인 서명"
          />
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

        {/* 체크리스트 (별지 제5호) */}
        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-[#002A80]">검측 체크리스트</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={generateChecklist}
                disabled={aiBusy}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {aiBusy ? "생성 중..." : "🤖 AI 생성"}
              </button>
              <button
                type="button"
                onClick={addItem}
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600"
              >
                + 항목
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-400">
              AI 생성 또는 + 항목으로 검측 항목을 추가하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 text-xs font-bold text-neutral-400">{idx + 1}</span>
                    <div className="flex-1 space-y-1.5">
                      <textarea
                        className="w-full resize-none rounded border border-neutral-300 px-2 py-1 text-sm"
                        rows={2}
                        value={it.checkItem}
                        placeholder="검측 항목"
                        onChange={(e) => setItem(idx, { checkItem: e.target.value })}
                      />
                      <input
                        className="w-full rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600"
                        value={it.standard}
                        placeholder="검사기준 (시방/도면)"
                        onChange={(e) => setItem(idx, { standard: e.target.value })}
                      />
                      <div className="flex items-center gap-1.5">
                        {(["합격", "불합격", "해당없음"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setItem(idx, { contractorResult: it.contractorResult === r ? "" : r })}
                            className={
                              "rounded px-2 py-0.5 text-xs font-semibold " +
                              (it.contractorResult === r
                                ? r === "불합격"
                                  ? "bg-red-600 text-white"
                                  : r === "합격"
                                  ? "bg-[#002A80] text-white"
                                  : "bg-neutral-500 text-white"
                                : "border border-neutral-300 text-neutral-500")
                            }
                          >
                            {r}
                          </button>
                        ))}
                        <input
                          className="ml-1 flex-1 rounded border border-neutral-200 px-2 py-0.5 text-xs"
                          value={it.contractorNote}
                          placeholder="조치사항"
                          onChange={(e) => setItem(idx, { contractorNote: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => saveDraft(false)}
            disabled={busy || !selectedDate}
            className="flex-1 rounded-md border border-[#002A80] px-4 py-2.5 text-sm font-semibold text-[#002A80] disabled:opacity-50"
          >
            {busy ? "저장 중..." : "임시 저장"}
          </button>
          <button
            type="button"
            onClick={tryOpenConsent}
            disabled={busy || !selectedDate}
            className="flex-1 rounded-md bg-[#002A80] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            제출
          </button>
        </div>

      {initialReqId && (
        <div className="mt-3 flex justify-center">
          <InspectionPdfButton requestId={initialReqId} label="📄 검측 서류 PDF (사진·영상 증빙 포함)" />
        </div>
      )}

      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowConsent(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-center text-base font-bold text-[#002A80]">[ 검측 자료 제출 전 필수 확인 ]</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              시공사가 등록하는 본 검측 자료(영상·사진·체크리스트)는 향후 시설물의 품질 보증 및 책임 시공을 증명하는 객관적 데이터베이스로 보관됩니다.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
              <li>자료 내/외의 모든 부실시공 및 시방서 미준수에 대한 책임</li>
              <li>현장 오인 유도, 자료 조작 및 은폐로 인한 문제 발생 시 책임</li>
              <li>자료에 담기지 않은 사각지대의 구조적 결함에 대한 책임</li>
            </ol>
            <p className="mt-3 rounded-md bg-neutral-50 p-2.5 text-xs leading-relaxed text-neutral-600">
              본 자료의 제출로 발생하는 시설물의 품질·안전 및 법적 책임은 전적으로 시공사에 있으며, 발주청은 사후 검증 및 원인 규명을 위한 데이터 보관 역할만을 수행합니다.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowConsent(false)}
                className="flex-1 rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => saveDraft(true)}
                disabled={busy}
                className="flex-1 rounded-md bg-[#002A80] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "제출 중..." : "확인했으며, 동의 후 제출합니다"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
