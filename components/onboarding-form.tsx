"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "@/components/kit/buttons";
import { SelectableCard } from "@/components/kit/selectable-card";

const BRANCHES = [
  "본부내근", "천안", "공주", "보령", "아산", "서산태안", "논산",
  "세종대전금산", "부여", "서천", "청양", "홍성", "예산", "당진",
];

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [role, setRole] = useState<"contractor" | "client">("contractor");
  const [f, setF] = useState({
    companyName: "",
    headquarters: "충남",
    branch: "",
    name: defaultName,
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onText =
    (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  const selectCls =
    "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30";

  async function submit() {
    setError("");
    if (!f.name || !f.email || !f.password) {
      setError("성명, 이메일, 비밀번호는 필수입니다.");
      return;
    }
    if (role === "contractor" && !f.companyName) {
      setError("회사명을 입력해 주세요.");
      return;
    }
    if (role === "client" && !f.branch) {
      setError("지사를 선택해 주세요.");
      return;
    }
    if (f.password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    const companyName = role === "client" ? "한국농어촌공사" : f.companyName;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          companyName,
          headquarters: f.headquarters,
          branch: f.branch,
          name: f.name,
          email: f.email,
          password: f.password,
          phone: f.phone,
        }),
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
      await signOut({ redirect: false });
      router.push("/login?registered=1");
    } catch (err) {
      setError("요청 실패: " + (err instanceof Error ? err.message : "네트워크 오류"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden border-neutral-200 p-0">
      <div className="bg-[#1E3A5F] px-6 py-7 text-center text-white">
        <div className="text-lg font-bold">회원가입</div>
        <div className="mt-1 text-xs text-white/70">카카오 인증 완료 · 정보를 입력해 주세요</div>
      </div>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
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

        {role === "client" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>본부 *</Label>
              <select className={selectCls} value={f.headquarters} onChange={onText("headquarters")}>
                <option value="충남">충남</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>지사 *</Label>
              <select className={selectCls} value={f.branch} onChange={onText("branch")}>
                <option value="">선택하세요</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label>회사명 *</Label>
            <Input value={f.companyName} onChange={onText("companyName")} />
          </div>
        )}

        <div className="space-y-1">
          <Label>성명 *</Label>
          <Input value={f.name} onChange={onText("name")} placeholder="홍길동" />
        </div>
        <div className="space-y-1">
          <Label>아이디(이메일) *</Label>
          <Input type="email" value={f.email} onChange={onText("email")} placeholder="이후 로그인에 사용됩니다" />
        </div>
        <div className="space-y-1">
          <Label>비밀번호 *</Label>
          <Input type="password" value={f.password} onChange={onText("password")} />
        </div>
        <div className="space-y-1">
          <Label>핸드폰</Label>
          <Input value={f.phone} onChange={onText("phone")} placeholder="010-0000-0000" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <ActionButton className="h-11 w-full text-base" onClick={submit} disabled={loading}>
          {loading ? "가입 처리 중..." : "가입 완료"}
        </ActionButton>
      </CardContent>
    </Card>
  );
}
