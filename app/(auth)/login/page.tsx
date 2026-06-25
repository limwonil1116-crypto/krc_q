"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PrimaryButton } from "@/components/kit/buttons";

// 금속 불꽃(엠버) - 고정 시드값으로 SSR/CSR 일치
const SPARKS = [
  { left: 49.7, delay: 1.1, dur: 4.1, drift: -13, size: 7 },
  { left: 24.0, delay: 4.0, dur: 5.2, drift: 10, size: 3 },
  { left: 81.0, delay: 2.7, dur: 4.9, drift: 6, size: 4 },
  { left: 59.2, delay: 4.3, dur: 6.1, drift: 19, size: 4 },
  { left: 34.5, delay: 3.6, dur: 6.1, drift: -8, size: 6 },
  { left: 50.0, delay: 4.3, dur: 5.0, drift: -5, size: 4 },
  { left: 50.1, delay: 2.3, dur: 4.7, drift: 23, size: 3 },
  { left: 50.0, delay: 5.0, dur: 5.4, drift: 25, size: 4 },
  { left: 31.2, delay: 5.2, dur: 5.7, drift: 13, size: 5 },
  { left: 50.3, delay: 5.4, dur: 6.4, drift: 8, size: 3 },
  { left: 28.1, delay: 0.9, dur: 5.7, drift: -4, size: 5 },
  { left: 50.8, delay: 0.8, dur: 5.5, drift: -6, size: 4 },
  { left: 50.0, delay: 1.1, dur: 6.0, drift: -23, size: 4 },
  { left: 49.9, delay: 3.0, dur: 6.1, drift: -19, size: 6 },
  { left: 50.0, delay: 0.3, dur: 5.8, drift: 11, size: 7 },
  { left: 55.6, delay: 3.3, dur: 4.8, drift: -21, size: 4 },
  { left: 46.9, delay: 5.5, dur: 4.8, drift: 22, size: 5 },
  { left: 47.8, delay: 2.7, dur: 4.3, drift: -13, size: 7 },
  { left: 62.3, delay: 1.0, dur: 3.8, drift: -11, size: 5 },
  { left: 63.5, delay: 1.9, dur: 4.7, drift: -8, size: 7 },
  { left: 49.6, delay: 2.3, dur: 4.7, drift: -21, size: 3 },
  { left: 77.9, delay: 4.0, dur: 4.8, drift: -3, size: 4 },
  { left: 66.3, delay: 1.2, dur: 5.8, drift: -21, size: 6 },
  { left: 54.0, delay: 1.2, dur: 6.0, drift: 9, size: 4 },
  { left: 49.4, delay: 2.4, dur: 6.5, drift: 20, size: 5 },
  { left: 86.7, delay: 1.4, dur: 5.1, drift: 21, size: 7 },
  { left: 47.9, delay: 2.6, dur: 4.0, drift: 21, size: 5 },
  { left: 70.4, delay: 2.3, dur: 5.6, drift: 6, size: 4 },
  { left: 49.3, delay: 3.7, dur: 6.2, drift: 6, size: 6 },
  { left: 49.9, delay: 2.1, dur: 6.3, drift: -8, size: 6 },
  { left: 48.9, delay: 1.6, dur: 6.2, drift: 20, size: 6 },
  { left: 37.0, delay: 3.5, dur: 5.6, drift: 13, size: 7 },
  { left: 53.2, delay: 2.2, dur: 6.2, drift: 8, size: 3 },
  { left: 28.6, delay: 2.9, dur: 3.6, drift: -10, size: 6 },
  { left: 90.3, delay: 5.4, dur: 5.1, drift: 16, size: 4 },
  { left: 45.2, delay: 4.7, dur: 4.9, drift: 3, size: 6 },
  { left: 50.6, delay: 3.5, dur: 5.9, drift: 14, size: 4 },
  { left: 55.0, delay: 5.5, dur: 6.0, drift: -22, size: 3 },
  { left: 86.1, delay: 2.3, dur: 4.7, drift: 3, size: 6 },
  { left: 50.3, delay: 1.6, dur: 5.9, drift: 26, size: 7 },
  { left: 49.6, delay: 4.3, dur: 4.4, drift: -9, size: 4 },
  { left: 73.9, delay: 4.8, dur: 5.7, drift: -6, size: 5 },
  { left: 84.5, delay: 1.0, dur: 4.4, drift: -12, size: 5 },
  { left: 65.0, delay: 3.8, dur: 4.2, drift: 21, size: 5 },
];

const SPARK_CSS = `
@keyframes krcEmberRise {
  0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
  8%   { opacity: 1; }
  50%  { transform: translate(calc(var(--drift) * 0.6px), calc(var(--rise) * -0.5)) scale(1); opacity: 1; }
  82%  { opacity: 0.85; }
  100% { transform: translate(calc(var(--drift) * 1px), calc(var(--rise) * -1)) scale(0.25); opacity: 0; }
}
@keyframes krcFlicker {
  0%,100% { filter: brightness(1); }
  50%     { filter: brightness(1.8); }
}
.krc-spark {
  position: absolute;
  bottom: 4%;
  --rise: 70vh;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 35%, #FFFBE6 0%, #FFE08A 38%, #FFC24B 70%, rgba(255,194,75,0) 100%);
  box-shadow: 0 0 10px 2px rgba(255,210,110,0.95), 0 0 22px 7px rgba(255,170,50,0.55);
  animation-name: krcEmberRise, krcFlicker;
  animation-timing-function: ease-out, ease-in-out;
  animation-iteration-count: infinite, infinite;
  will-change: transform, opacity;
}
@media (prefers-reduced-motion: reduce) { .krc-spark { display: none; } }
`;

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
    <>
      <style>{SPARK_CSS}</style>

      {/* 배경: 본사 사옥 + KRC 블루 오버레이 */}
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hq-bg.jpg" alt="한국농어촌공사 본사" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#001A52]/80 via-[#0033A0]/72 to-[#001233]/90" />
        {/* 금속 불꽃 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="krc-spark"
              style={{
                left: `${s.left}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                ["--drift" as string]: `${s.drift}`,
                animationDuration: `${s.dur}s, 1.2s`,
                animationDelay: `${s.delay}s, ${s.delay}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <Card className="w-full overflow-hidden rounded-2xl border border-white/40 p-0 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/20" style={{ backgroundColor: "rgba(255,255,255,0.38)" }}>
          <div className="px-6 py-8 text-center" style={{ backgroundColor: "rgba(0,51,160,0.82)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/krc-logo-white.png" alt="한국농어촌공사" className="mx-auto h-8 w-auto" />
            <div className="mt-4 text-xl font-extrabold tracking-tight text-white">KRC 건설공사실록</div>
            <div className="mt-1 text-xs text-white/70">동영상 기록관리 플랫폼</div>
          </div>
          <CardContent className="space-y-4 p-6" style={{ backgroundColor: "transparent" }}>
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

            <div className="flex items-center gap-3 text-xs font-bold text-[#0A2540]">
              <div className="h-px flex-1 bg-[#0A2540]/30" />
              또는 이메일로 로그인
              <div className="h-px flex-1 bg-[#0A2540]/30" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-[#0A2540]">이메일</Label>
              <Input id="email" type="email" className="bg-white/90" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[#0A2540]">비밀번호</Label>
              <Input
                id="password"
                type="password"
                className="bg-white/90"
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

        {/* 문의 / 저작권 */}
        <div className="mt-5 space-y-1 text-center">
          <p className="text-xs text-white/85">
            문의사항 : 한국농어촌공사 충남지역본부 임원일 과장(041-339-1844)
          </p>
          <p className="text-[11px] text-white/60">© 2026 한국농어촌공사 All rights reserved</p>
        </div>
      </div>
    </>
  );
}
