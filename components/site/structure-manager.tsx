"use client";

import { useState } from "react";
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

export function StructureManager({
  siteId,
  structureBase,
  categories,
  structures,
}: {
  siteId: string;
  structureBase: string;
  categories: Cat[];
  structures: S[];
}) {
  const router = useRouter();
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

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [editErr, setEditErr] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  function pickCat(c: Cat) {
    setCatId(c.id);
  }

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

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-[#1E3A5F]">구조물 등록 및 조회</h1>

      <StepSection step="STEP 04" title="구조물(대분류) 등록" desc="대분류를 선택하고 이름을 붙여 추가하세요. 세부 항목은 등록 후 기록 화면에서 선택합니다.">
        <Label>대분류</Label>
        <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {categories.map((c) => (
            <SelectableCard
              key={c.id}
              label={c.name}
              icon={CAT_ICON[c.code] || "🏗️"}
              selected={catId === c.id}
              onClick={() => pickCat(c)}
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

      <StepSection step="등록됨" title={`등록된 구조물 (${structures.length})`}>
        {structures.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 추가된 구조물이 없습니다.</p>
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
                      <div>
                        <div className="font-semibold text-[#1E293B]">{s.name}</div>
                        <div className="text-xs text-neutral-500">
                          {s.typeName}
                          {s.locationDescription ? ` · ${s.locationDescription}` : ""}
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
                        className="whitespace-nowrap rounded-md bg-[#1E3A5F] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#16304d]"
                      >
                        세부항목·검측 기록 →
                      </Link>
                      <Link
                        href={`${structureBase}/${s.id}/video`}
                        className="whitespace-nowrap rounded-md bg-[#F37021] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#DA631C]"
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
    </div>
  );
}
