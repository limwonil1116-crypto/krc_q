"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StepSection } from "@/components/kit/step-section";
import { BottomBar } from "@/components/kit/bottom-bar";
import { ActionButton } from "@/components/kit/buttons";
import { KakaoMapPicker } from "@/components/kit/kakao-map-picker";

const PROJECT_TYPES = [
  "다목적용수", "체계재편", "논범용화", "배수개선", "경지정리", "대행위탁사업",
  "방조제개보수", "수리시설개보수", "수질개선", "지역개발", "기타",
];
const EXECUTORS = [
  "천안지사", "공주지사", "보령지사", "아산지사", "서산태안지사", "논산지사",
  "세종대전금산지사", "부여지사", "서천지사", "청양지사", "홍성지사", "예산지사", "당진지사",
];
const WORK_TYPES = ["철근콘크리트", "토목", "건축", "조경", "기타"];

type InitialSite = {
  clientOrgId?: string | null;
  districtName?: string;
  projectName?: string;
  executor?: string | null;
  workType?: string | null;
  supervisorName?: string | null;
  supervisorPhone?: string | null;
  supervisorEmail?: string | null;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  startedOn?: string | null;
  endedOn?: string | null;
  siteCode?: string | null;
};

type Form = {
  clientOrgId: string;
  districtName: string;
  project: string;
  projectEtc: string;
  executor: string;
  workType: string;
  supervisorName: string;
  supervisorPhone: string;
  supervisorEmail: string;
  address: string;
  lat: number | null;
  lng: number | null;
  startedOn: string;
  endedOn: string;
  siteCode: string;
};

function buildInitial(initial?: InitialSite): Form {
  const pn = initial?.projectName ?? "";
  const isPreset = PROJECT_TYPES.includes(pn) && pn !== "기타";
  return {
    clientOrgId: initial?.clientOrgId ?? "",
    districtName: initial?.districtName ?? "",
    project: isPreset ? pn : pn ? "기타" : "",
    projectEtc: isPreset ? "" : pn,
    executor: initial?.executor ?? "",
    workType: initial?.workType ?? "",
    supervisorName: initial?.supervisorName ?? "",
    supervisorPhone: initial?.supervisorPhone ?? "",
    supervisorEmail: initial?.supervisorEmail ?? "",
    address: initial?.address ?? "",
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
    startedOn: initial?.startedOn ?? "",
    endedOn: initial?.endedOn ?? "",
    siteCode: initial?.siteCode ?? "",
  };
}

export function SiteForm({
  clientOrgs,
  mode = "contractor",
  siteId,
  initial,
}: {
  clientOrgs: { id: string; name: string }[];
  mode?: "contractor" | "client";
  siteId?: string;
  initial?: InitialSite;
}) {
  const router = useRouter();
  const isEdit = !!siteId;
  const listPath = mode === "client" ? "/client/sites" : "/contractor/sites";
  const [f, setF] = useState<Form>(buildInitial(initial));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onText =
    (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value } as Form));

  async function submit() {
    setError("");
    const projectName = f.project === "기타" ? f.projectEtc.trim() : f.project;
    if (!f.districtName || !projectName || !f.address) {
      setError("지구명, 사업, 현장 주소는 필수입니다.");
      return;
    }
    if (!f.project) {
      setError("사업을 선택해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        clientOrgId: f.clientOrgId,
        districtName: f.districtName,
        projectName,
        executor: f.executor,
        workType: f.workType,
        supervisorName: f.supervisorName,
        supervisorPhone: f.supervisorPhone,
        supervisorEmail: f.supervisorEmail,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        startedOn: f.startedOn,
        endedOn: f.endedOn,
        siteCode: f.siteCode,
      };
      const res = await fetch(isEdit ? `/api/sites/${siteId}` : "/api/sites", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // 빈 응답 방어
      }
      if (!res.ok || !data.ok) {
        setError(data.error || ("서버 오류 (" + res.status + ")"));
        return;
      }
      router.push(listPath);
      router.refresh();
    } catch (err) {
      setError("요청 실패: " + (err instanceof Error ? err.message : "네트워크 오류"));
    } finally {
      setLoading(false);
    }
  }

  const selectCls =
    "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30";

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-[#1E3A5F]">{isEdit ? "현장 수정" : "현장 등록"}</h1>

      <StepSection step="STEP 01" title="사업 정보">
        <div className="space-y-3">
          {mode === "contractor" && (
            <div className="space-y-1">
              <Label>발주청</Label>
              <select className={selectCls} value={f.clientOrgId} onChange={onText("clientOrgId")}>
                <option value="">선택하세요</option>
                {clientOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>지구명 *</Label>
            <Input value={f.districtName} onChange={onText("districtName")} />
          </div>
          <div className="space-y-1">
            <Label>사업 *</Label>
            <select className={selectCls} value={f.project} onChange={onText("project")}>
              <option value="">선택하세요</option>
              {PROJECT_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {f.project === "기타" && (
            <div className="space-y-1">
              <Label>사업명 직접 입력 *</Label>
              <Input value={f.projectEtc} onChange={onText("projectEtc")} placeholder="사업명을 입력하세요" />
            </div>
          )}
          <div className="space-y-1">
            <Label>사업시행자</Label>
            <select className={selectCls} value={f.executor} onChange={onText("executor")}>
              <option value="">선택하세요</option>
              {EXECUTORS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>공종 분류</Label>
            <select className={selectCls} value={f.workType} onChange={onText("workType")}>
              <option value="">선택하세요</option>
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>
      </StepSection>

      <StepSection step="STEP 02" title="공감소장 정보" desc="제출 알림이 이 이메일로 발송됩니다.">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>공감소장 이름</Label>
            <Input value={f.supervisorName} onChange={onText("supervisorName")} />
          </div>
          <div className="space-y-1">
            <Label>핸드폰</Label>
            <Input value={f.supervisorPhone} onChange={onText("supervisorPhone")} />
          </div>
          <div className="space-y-1">
            <Label>이메일</Label>
            <Input type="email" value={f.supervisorEmail} onChange={onText("supervisorEmail")} />
          </div>
        </div>
      </StepSection>

      <StepSection step="STEP 03" title="현장 위치" desc="주소를 검색하거나 지도를 눌러 위치를 지정하세요.">
        <KakaoMapPicker
          value={{ lat: f.lat, lng: f.lng, address: f.address }}
          onChange={(v) => setF((p) => ({ ...p, lat: v.lat, lng: v.lng, address: v.address }))}
        />
        <div className="mt-3 space-y-1">
          <Label>현장 주소 *</Label>
          <Input value={f.address} onChange={onText("address")} />
        </div>
      </StepSection>

      <StepSection step="STEP 04" title="공사 기간 · 코드">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>시작일</Label>
            <Input type="date" value={f.startedOn} onChange={onText("startedOn")} />
          </div>
          <div className="space-y-1">
            <Label>종료일</Label>
            <Input type="date" value={f.endedOn} onChange={onText("endedOn")} />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label>현장 코드 / 사업관리번호</Label>
          <Input value={f.siteCode} onChange={onText("siteCode")} />
        </div>
      </StepSection>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <BottomBar>
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.push(listPath)}>
          취소
        </Button>
        <ActionButton className="flex-1" onClick={submit} disabled={loading}>
          {loading ? "저장 중..." : isEdit ? "수정 저장" : "저장"}
        </ActionButton>
      </BottomBar>
    </div>
  );
}
