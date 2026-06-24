"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PrimaryButton } from "@/components/kit/buttons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("registered")) {
      setRegistered(true);
    }
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("이메일/비밀번호가 올바르지 않습니다.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm overflow-hidden border-neutral-200 p-0">
      <div className="bg-[#0033A0] px-6 py-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/krc-logo-white.png" alt="한국농어촌공사" className="mx-auto h-8 w-auto" />
        <div className="mt-4 text-base font-bold text-white">현장기록 자동영상화 시스템</div>
        <div className="mt-1 text-xs text-white/70">한국농어촌공사 공사기록 플랫폼</div>
      </div>
      <CardContent className="space-y-4 p-6">
        {registered && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            가입이 완료되었습니다. 등록한 이메일/비밀번호로 로그인하세요.
          </div>
        )}

        <button
          type="button"
          onClick={() => signIn("kakao", { callbackUrl: "/" })}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] font-semibold text-black/85 hover:brightness-95"
        >
          <span>💬</span> 카카오로 회원가입 / 로그인
        </button>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <div className="h-px flex-1 bg-neutral-200" />
          또는 이메일로 로그인
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <PrimaryButton className="h-11 w-full text-base" onClick={handleLogin} disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </PrimaryButton>
      </CardContent>
    </Card>
  );
}
