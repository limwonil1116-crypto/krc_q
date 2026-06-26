"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionButton } from "@/components/kit/buttons";
import { SelectableCard } from "@/components/kit/selectable-card";
import { KRC_BRANCHES } from "@/lib/perm";

export function MypageForm({
  initial,
  hasPassword,
  editableRole,
}: {
  initial: { name: string; phone: string; role: string; branch: string };
  hasPassword: boolean;
  editableRole: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [role, setRole] = useState<"contractor" | "client">(
    initial.role === "client" ? "client" : "contractor"
  );
  const [branch, setBranch] = useState(initial.branch);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const selectCls =
    "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30";

  async function saveInfo() {
    setMsg("");
    setErr("");
    if (!name.trim()) {
      setErr("이름을 입력하세요.");
      return;
    }
    if (editableRole && role === "client" && !branch) {
      setErr("소속 지사를 선택하세요.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = { name: name.trim(), phone: phone.trim() };
      if (editableRole) {
        payload.role = role;
        if (role === "client") payload.branch = branch;
      }
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        setErr(data.error || ("서버 오류 (" + res.status + ")"));
        return;
      }
      setMsg("정보가 저장되었습니다.");
      router.refresh();
    } catch (e) {
      setErr("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    setPwMsg("");
    setPwErr("");
    if (newPw.length < 6) {
      setPwErr("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPw !== newPw2) {
      setPwErr("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok || !data.ok) {
        setPwErr(data.error || ("서버 오류 (" + res.status + ")"));
        return;
      }
      setPwMsg("비밀번호가 변경되었습니다.");
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      setPwOpen(false);
    } catch (e) {
      setPwErr("요청 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="space-y-1">
          <Label>성명 *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
        </div>
        <div className="space-y-1">
          <Label>핸드폰</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
        </div>

        {editableRole && (
          <>
            <div className="space-y-1">
              <Label>분류 *</Label>
              <div className="grid grid-cols-2 gap-2">
                <SelectableCard
                  label="시공사"
                  icon="🏗️"
                  selected={role === "contractor"}
                  onClick={() => setRole("contractor")}
                />
                <SelectableCard
                  label="한국농어촌공사"
                  icon="🏛️"
                  selected={role === "client"}
                  onClick={() => setRole("client")}
                />
              </div>
            </div>
            {role === "client" && (
              <div className="space-y-1">
                <Label>소속 (지사) *</Label>
                <select className={selectCls} value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="">선택하세요</option>
                  {KRC_BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b === "본부내근" ? "충남본부 내근" : `${b}지사`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400">
                  본부 내근은 전체 현장, 각 지사는 해당 지사 현장만 조회·수정할 수 있습니다.
                </p>
              </div>
            )}
          </>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <ActionButton className="w-full" onClick={saveInfo} disabled={loading}>
          {loading ? "저장 중..." : "정보 저장"}
        </ActionButton>
      </div>

      {hasPassword && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <button
            type="button"
            onClick={() => setPwOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="font-semibold text-[#0A2540]">비밀번호 변경</span>
            <span className="text-neutral-400">{pwOpen ? "▲" : "▼"}</span>
          </button>
          {pwOpen && (
            <div className="space-y-3 border-t border-neutral-100 pt-3">
              <div className="space-y-1">
                <Label>현재 비밀번호</Label>
                <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>새 비밀번호</Label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="6자 이상" />
              </div>
              <div className="space-y-1">
                <Label>새 비밀번호 확인</Label>
                <Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
              </div>
              {pwErr && <p className="text-sm text-red-600">{pwErr}</p>}
              {pwMsg && <p className="text-sm text-green-600">{pwMsg}</p>}
              <ActionButton className="w-full" onClick={changePassword} disabled={pwLoading}>
                {pwLoading ? "변경 중..." : "비밀번호 변경"}
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
