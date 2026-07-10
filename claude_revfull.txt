"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  itemNo: number;
  checkItem: string;
  standard: string | null;
  contractorResult: string | null;
  contractorNote: string | null;
  supervisorResult: string | null;
  supervisorNote: string | null;
};
type Checklist = { id: string; facilityName: string | null; workName: string | null; items: Item[] };
type Req = {
  id: string;
  inspectionDate: string | null;
  requestNo: string | null;
  locationWork: string | null;
  inspectionPart: string | null;
  inspectionMatter: string | null;
  isRecheck: boolean;
  contractorAgentName: string | null;
  contractorCheckerName: string | null;
  inspectionResult: string | null;
  instruction: string | null;
  status: string;
  structureName: string;
  projectName: string;
  districtName: string;
};

const RESULT_COLOR: Record<string, string> = {
  합격: "text-[#002A80]",
  불합격: "text-red-600",
  해당없음: "text-neutral-400",
};

export function SupervisorReview({
  request,
  checklists,
  backHref,
}: {
  request: Req;
  checklists: Checklist[];
  backHref: string;
}) {
  const router = useRouter();
  const readOnly = request.status === "approved";

  // 항목별 감독 2차 체크 상태
  const [reviews, setReviews] = useState<Record<string, { result: string; note: string }>>(() => {
    const init: Record<string, { result: string; note: string }> = {};
    checklists.forEach((cl) =>
      cl.items.forEach((it) => {
        init[it.id] = { result: it.supervisorResult || "", note: it.supervisorNote || "" };
      })
    );
    return init;
  });
  const [result, setResult] = useState(request.inspectionResult || "");
  const [instruction, setInstruction] = useState(request.instruction || "");
  const [busy, setBusy] = useState(false);

  function setReview(id: string, patch: Partial<{ result: string; note: string }>) {
    setReviews((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  }

  async function save(action: "save" | "revision") {
    setBusy(true);
    try {
      const itemReviews = Object.entries(reviews).map(([id, v]) => ({
        id,
        supervisorResult: v.result,
        supervisorNote: v.note,
      }));
      const res = await fetch("/api/inspections/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: request.id,
          inspectionResult: result,
          instruction,
          itemReviews,
          requestRevision: action === "revision",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "저장 실패");
        return;
      }
      alert(action === "revision" ? "재검측을 요청했습니다." : "검토 내용을 저장했습니다.");
      router.refresh();
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const cardCls = "rounded-lg border border-neutral-200 bg-white p-4";
  const labelCls = "block text-xs font-semibold text-neutral-500 mb-1";

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0033A0]">
            {request.isRecheck && <span className="text-red-600">(재) </span>}
            검측 결과 통보
          </h1>
          <p className="text-sm text-neutral-500">{request.projectName}</p>
        </div>
        <Link href={backHref} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
          ← 목록
        </Link>
      </div>

      {/* 요청서 정보 */}
      <div className={cardCls}>
        <p className="mb-2 text-sm font-bold text-neutral-700">검측 요청 정보</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-neutral-400">구조물</span> {request.structureName}</div>
          <div><span className="text-neutral-400">검측일</span> {request.inspectionDate}</div>
          <div><span className="text-neutral-400">위치·공종</span> {request.locationWork || "-"}</div>
          <div><span className="text-neutral-400">검측부위</span> {request.inspectionPart || "-"}</div>
          <div className="col-span-2"><span className="text-neutral-400">검측사항</span> {request.inspectionMatter || "-"}</div>
          <div><span className="text-neutral-400">현장대리인</span> {request.contractorAgentName || "-"}</div>
          <div><span className="text-neutral-400">점검직원</span> {request.contractorCheckerName || "-"}</div>
        </div>
      </div>

      {/* 체크리스트 2차 체크 */}
      {checklists.map((cl) => (
        <div key={cl.id} className={cardCls}>
          <p className="mb-3 text-sm font-bold text-neutral-700">
            체크리스트 {cl.workName ? `· ${cl.workName}` : ""}
          </p>
          <div className="space-y-3">
            {cl.items.map((it) => (
              <div key={it.id} className="rounded-md border border-neutral-200 p-2.5">
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-neutral-400">{it.itemNo}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-800">{it.checkItem}</p>
                    {it.standard && <p className="mt-0.5 text-xs text-neutral-500">기준: {it.standard}</p>}

                    {/* 시공자 1차 결과 */}
                    <div className="mt-2 rounded bg-neutral-50 px-2 py-1 text-xs">
                      <span className="text-neutral-400">시공자: </span>
                      <span className={"font-semibold " + (RESULT_COLOR[it.contractorResult || ""] || "text-neutral-400")}>
                        {it.contractorResult || "미체크"}
                      </span>
                      {it.contractorNote && <span className="text-neutral-500"> · {it.contractorNote}</span>}
                    </div>

                    {/* 감독 2차 체크 */}
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-xs text-[#0033A0]">감독:</span>
                      {(["합격", "불합격", "해당없음"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          disabled={readOnly}
                          onClick={() => setReview(it.id, { result: reviews[it.id]?.result === r ? "" : r })}
                          className={
                            "rounded px-2 py-0.5 text-xs font-semibold disabled:opacity-60 " +
                            (reviews[it.id]?.result === r
                              ? r === "불합격"
                                ? "bg-red-600 text-white"
                                : r === "합격"
                                ? "bg-[#0033A0] text-white"
                                : "bg-neutral-500 text-white"
                              : "border border-neutral-300 text-neutral-500")
                          }
                        >
                          {r}
                        </button>
                      ))}
                      <input
                        className="ml-1 flex-1 rounded border border-neutral-200 px-2 py-0.5 text-xs"
                        placeholder="특기사항"
                        disabled={readOnly}
                        value={reviews[it.id]?.note || ""}
                        onChange={(e) => setReview(it.id, { note: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 검측 결과 / 지시사항 */}
      <div className={cardCls}>
        <p className="mb-2 text-sm font-bold text-neutral-700">검측 결과 통보</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>검측 결과</label>
            <textarea
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              rows={2}
              disabled={readOnly}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="예: 적합 / 조건부 합격 등"
            />
          </div>
          <div>
            <label className={labelCls}>지시 사항</label>
            <textarea
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              rows={2}
              disabled={readOnly}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 서명·승인 자리 (4-4 에서 채움) */}
      <div className="rounded-md border border-dashed border-neutral-300 p-3 text-center text-sm text-neutral-400">
        서명 및 승인 (다음 단계에서 추가)
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => save("save")}
            disabled={busy}
            className="flex-1 rounded-md border border-[#0033A0] px-4 py-2.5 text-sm font-semibold text-[#0033A0] disabled:opacity-50"
          >
            {busy ? "저장 중..." : "검토 저장"}
          </button>
          <button
            type="button"
            onClick={() => save("revision")}
            disabled={busy}
            className="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            재검측 요청
          </button>
        </div>
      )}

      {readOnly && (
        <div className="rounded-md bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700">
          ✅ 승인 완료된 검측입니다.
        </div>
      )}
    </div>
  );
}
