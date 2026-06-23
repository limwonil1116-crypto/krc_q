"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton, PrimaryButton } from "@/components/kit/buttons";

const FIELDS: [string, string][] = [
  ["companyName", "회사명 *"],
  ["businessNumber", "사업자등록번호"],
  ["name", "담당자명 *"],
  ["phone", "휴대폰번호"],
  ["email", "이메일 *"],
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({
    companyName: "",
    businessNumber: "",
    name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSignup() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "가입에 실패했습니다.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card className="w-full max-w-md overflow-hidden border-neutral-200 p-0">
        <div className="bg-[#1E3A5F] px-6 py-7 text-center text-white">
          <div className="text-lg font-bold">가입 신청 완료</div>
        </div>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-neutral-600">운영자 승인 후 로그인할 수 있습니다.</p>
          <PrimaryButton className="w-full" onClick={() => router.push("/login")}>
            로그인 화면으로
          </PrimaryButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md overflow-hidden border-neutral-200 p-0">
      <div className="bg-[#1E3A5F] px-6 py-7 text-center text-white">
        <div className="text-lg font-bold">회원가입 (시공사)</div>
        <div className="mt-1 text-xs text-white/70">가입 후 운영자 승인이 필요합니다</div>
      </div>
      <CardContent className="space-y-3 p-6">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={k}>{label}</Label>
            <Input id={k} value={form[k]} onChange={set(k)} />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="password">비밀번호 *</Label>
          <Input id="password" type="password" value={form.password} onChange={set("password")} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ActionButton className="h-11 w-full text-base" onClick={handleSignup} disabled={loading}>
          {loading ? "신청 중..." : "가입 신청"}
        </ActionButton>
        <p className="text-center text-sm text-neutral-500">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="font-semibold text-[#F37021] underline">
            로그인
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
