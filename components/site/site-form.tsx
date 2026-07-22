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
import { ParticipantManager } from "@/components/site/participant-manager";

const PROJECT_TYPES = [
  "다목적용수", "체계재편", "논범용화", "배수개선", "경지정리", "대행위탁사업",
  "방조제개보수", "수리시설개보수", "수질개선", "지역개발", "기타",
];
const EXECUTORS: { value: string; label: string }[] = [
  { value: "본부내근", label: "충남본부 내근" },
  { value: "천안", label: "천안지사" },
  { value: "공주", label: "공주지사" },
  { value: "보령", label: "보령지사" },
  { value: "아산", label: "아산지사" },
  { value: "서산태안", label: "서산태안지사" },
  { value: "논산", label: "논산지사" },
  { value: "세종대전금산", label: "세종대전금산지사" },
  { value: "부여", label: "부여지사" },
  { value: "서천", label: "서천지사" },
  { value: "청양", label: "청양지사" },
  { value: "홍성", label: "홍성지사" },
  { value: "예산", label: "예산지사" },
  { value: "당진", label: "당진지사" },
];
const WORK_TYPES = ["철근콘크리트", "토목", "건축", "조경", "기타"];

type InitialSite = {
  clientOrgId?: string | null;
  districtName?: string;
  projectName?: string;
  executor?: string | null;
  workType?: string | null;
  workTypes?: string | null;
  supervisorName?: string | null;
  supervisorPhone?: string | null;
  supervisorEmail?: string | null;
  siteManagerName?: string | null;
  siteManagerPhone?: string | null;
  siteManagerEmail?: string | null;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  startedOn?: string | null;
  endedOn?: string | null;
  contractorLogoName?: string | null;
  contractorCompany?: string | null;
};

type Form = {
  clientOrgId: string;
  districtName: string;
  project: string;
  projectEtc: string;
  executor: string;
  workTypes: string[];
  supervisorName: string;
  supervisorPhone: string;
  supervisorEmail: string;
  contractorCompany: string;
  siteManagerName: string;
  siteManagerPhone: string;
  siteManagerEmail: string;
  address: string;
  lat: number | null;
  lng: number | null;
  startedOn: string;
  endedOn: string;
};

function buildInitial(initial?: InitialSite): Form {
  const pn = initial?.projectName ?? "";
  const isPreset = PROJECT_TYPES.includes(pn) && pn !== "기타";
  // 공종: workTypes(콤마) 우선, 없으면 기존 단일 workType
  let wt: string[] = [];
  if (initial?.workTypes) {
    wt = initial.workTypes.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (initial?.workType) {
    wt = initial.workType.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  }
  return {
    clientOrgId: initial?.clientOrgId ?? "",
    districtName: initial?.districtName ?? "",
    project: isPreset ? pn : pn ? "기타" : "",
    projectEtc: isPreset ? "" : pn,
    executor: initial?.executor ?? "",
    workTypes: wt,
    supervisorName: initial?.supervisorName ?? "",
    supervisorPhone: initial?.supervisorPhone ?? "",
    supervisorEmail: initial?.supervisorEmail ?? "",
    contractorCompany: initial?.contractorCompany ?? "",
    siteManagerName: initial?.siteManagerName ?? "",
    siteManagerPhone: initial?.siteManagerPhone ?? "",
    siteManagerEmail: initial?.siteManagerEmail ?? "",
    address: initial?.address ?? "",
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
    startedOn: initial?.startedOn ?? "",
    endedOn: initial?.endedOn ?? "",
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
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoName, setLogoName] = useState<string>(initial?.contractorLogoName ?? "");
  const [logoVer, setLogoVer] = useState(0);
  const [logoBusy, setLogoBusy] = useState(false);

  async function uploadLogo(file: File) {
    if (!siteId) return;
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/sites/${siteId}/logo`, { method: "POST", body: fd });
      let data: { ok?: boolean; error?: string; name?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        alert(data.error || "로고 업로드 실패");
        return;
      }
      setLogoName(data.name || file.name);
      setLogoVer((v) => v + 1);
    } catch (e) {
      alert("로고 업로드 오류: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeSite() {
    if (!siteId) return;
    if (!confirm("이 현장과 모든 하위 데이터를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        setError(data.error || "현장 삭제에 실패했습니다.");
        return;
      }
      router.push(listPath);
    } catch (e) {
      setError("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setDelBusy(false);
    }
  }
  async function deleteLogo() {
    if (!siteId || !confirm("시공사 로고를 삭제할까요?")) return;
    setLogoBusy(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/logo`, { method: "DELETE" });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        alert(data.error || "로고 삭제 실패");
        return;
      }
      setLogoName("");
      setLogoVer((v) => v + 1);
    } catch (e) {
      alert("로고 삭제 오류: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setLogoBusy(false);
    }
  }

  const onText =
    (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value } as Form));

  function toggleWork(w: string) {
    setF((p) => ({
      ...p,
      workTypes: p.workTypes.includes(w) ? p.workTypes.filter((x) => x !== w) : [...p.workTypes, w],
    }));
  }

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
        workType: f.workTypes.join(", "),
        workTypes: f.workTypes.join(","),
        supervisorName: f.supervisorName,
        supervisorPhone: f.supervisorPhone,
        supervisorEmail: f.supervisorEmail,
        contractorCompany: f.contractorCompany,
        siteManagerName: f.siteManagerName,
        siteManagerPhone: f.siteManagerPhone,
        siteManagerEmail: f.siteManagerEmail,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        startedOn: f.startedOn,
        endedOn: f.endedOn,
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
    "h-12 w-full rounded-md border border-neutral-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-[#0033A0]">{isEdit ? "현장 수정" : "현장 등록"}</h1>

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
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>공종 분류 (중복 선택 가능)</Label>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPES.map((w) => {
                const on = f.workTypes.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWork(w)}
                    className={
                      "rounded-full px-4 py-2 text-base font-semibold transition " +
                      (on ? "bg-[#0033A0] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
                    }
                  >
                    {on ? "✓ " : ""}
                    {w}
                  </button>
                );
              })}
            </div>
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

      <StepSection step="STEP 03" title="현장소장 정보">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>시공사 (회사명)</Label>
            <Input
              value={f.contractorCompany}
              onChange={onText("contractorCompany")}
              placeholder="예: 00건설(주)"
            />
          </div>
          <div className="space-y-1">
            <Label>현장소장 이름</Label>
            <Input value={f.siteManagerName} onChange={onText("siteManagerName")} />
          </div>
          <div className="space-y-1">
            <Label>핸드폰</Label>
            <Input value={f.siteManagerPhone} onChange={onText("siteManagerPhone")} />
          </div>
          <div className="space-y-1">
            <Label>이메일</Label>
            <Input type="email" value={f.siteManagerEmail} onChange={onText("siteManagerEmail")} />
          </div>
        </div>
      </StepSection>

      {isEdit && (
        <StepSection step="로고" title="시공사 로고" desc="영상 첫 화면 하단에 농어촌공사 로고와 함께 표시됩니다. (4MB 이하 이미지)">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {logoName ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/sites/${siteId}/logo/raw?v=${logoVer}`}
                  alt="시공사 로고"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-neutral-400">로고 없음</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-[#0033A0] hover:bg-neutral-50">
                {logoBusy ? "처리 중..." : logoName ? "로고 변경" : "로고 업로드"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={logoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {logoName && (
                <button
                  type="button"
                  onClick={deleteLogo}
                  disabled={logoBusy}
                  className="ml-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-neutral-50"
                >
                  삭제
                </button>
              )}
              {logoName && <p className="text-xs text-neutral-500">{logoName}</p>}
            </div>
          </div>
        </StepSection>
      )}

      <StepSection step="STEP 04" title="현장 위치" desc="주소를 검색하거나 지도를 눌러 위치를 지정하세요.">
        <KakaoMapPicker
          value={{ lat: f.lat, lng: f.lng, address: f.address }}
          onChange={(v) => setF((p) => ({ ...p, lat: v.lat, lng: v.lng, address: v.address }))}
        />
        <div className="mt-3 space-y-1">
          <Label>현장 주소 *</Label>
          <Input value={f.address} onChange={onText("address")} />
        </div>
      </StepSection>

      <StepSection step="STEP 05" title="공사 기간">
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
      </StepSection>

      {siteId && (
        <div>
          <p className="mb-1 text-xs font-bold tracking-wide text-[#FE5000]">STEP 06</p>
          <ParticipantManager siteId={siteId} canManage />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isEdit && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">⚠️ 현장 삭제</p>
          <p className="mt-1 text-xs text-red-600">
            이 현장의 지구·검측기록·사진·영상·검측요청서가 <b>모두 삭제</b>됩니다. 되돌릴 수 없습니다.
            <br />
            (구글 드라이브에 저장된 원본 영상 파일은 보존됩니다)
          </p>
          <p className="mt-3 text-xs text-neutral-700">
            삭제하려면 현장명 <b>{f.projectName || initial?.projectName || ""}</b> 을(를) 정확히 입력하세요.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={delConfirm}
              onChange={(e) => setDelConfirm(e.target.value)}
              placeholder="현장명 입력"
              className="flex-1"
            />
            <button
              type="button"
              onClick={removeSite}
              disabled={delBusy || delConfirm.trim() !== (f.projectName || "").trim() || !delConfirm.trim()}
              className="whitespace-nowrap rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {delBusy ? "삭제 중..." : "🗑 영구 삭제"}
            </button>
          </div>
        </div>
      )}

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
