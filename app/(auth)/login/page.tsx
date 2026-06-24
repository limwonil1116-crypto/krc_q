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
  { left: 33.4, top: 19.0, delay: 3.9, dur: 5.3, dx: -24, dy: -32, size: 3 },
  { left: 6.5, top: 43.3, delay: 0.4, dur: 5.4, dx: 16, dy: -33, size: 5 },
  { left: 92.1, top: 55.6, delay: 2.4, dur: 8.9, dx: -28, dy: -18, size: 3 },
  { left: 53.8, top: 55.1, delay: 3.4, dur: 7.7, dx: -29, dy: -20, size: 5 },
  { left: 69.9, top: 54.5, delay: 3.7, dur: 7.0, dx: 34, dy: 25, size: 4 },
  { left: 37.0, top: 27.4, delay: 1.1, dur: 8.1, dx: -29, dy: 31, size: 4 },
  { left: 30.1, top: 90.3, delay: 0.7, dur: 6.7, dx: 18, dy: 21, size: 3 },
  { left: 74.9, top: 55.3, delay: 5.3, dur: 6.3, dx: 29, dy: 14, size: 3 },
  { left: 91.8, top: 46.8, delay: 4.0, dur: 5.2, dx: 31, dy: 18, size: 4 },
  { left: 86.4, top: 35.8, delay: 5.6, dur: 6.4, dx: -27, dy: -29, size: 3 },
  { left: 72.4, top: 40.2, delay: 5.5, dur: 7.0, dx: -26, dy: 31, size: 4 },
  { left: 84.2, top: 29.9, delay: 2.5, dur: 6.4, dx: 39, dy: -14, size: 3 },
  { left: 24.8, top: 26.1, delay: 2.9, dur: 7.4, dx: 21, dy: -21, size: 4 },
  { left: 60.3, top: 33.4, delay: 0.8, dur: 8.4, dx: -26, dy: 21, size: 4 },
  { left: 12.7, top: 60.5, delay: 0.4, dur: 5.3, dx: -25, dy: -19, size: 3 },
  { left: 12.6, top: 54.7, delay: 3.2, dur: 8.8, dx: -16, dy: -26, size: 3 },
  { left: 62.6, top: 88.2, delay: 3.6, dur: 6.9, dx: -36, dy: 23, size: 4 },
  { left: 11.1, top: 14.8, delay: 2.1, dur: 6.1, dx: -27, dy: -33, size: 5 },
  { left: 37.0, top: 65.3, delay: 5.5, dur: 8.0, dx: 39, dy: -27, size: 4 },
  { left: 51.7, top: 84.1, delay: 2.1, dur: 5.9, dx: 31, dy: -30, size: 4 },
  { left: 72.5, top: 25.5, delay: 3.1, dur: 6.4, dx: -40, dy: 22, size: 3 },
  { left: 68.1, top: 88.3, delay: 2.7, dur: 8.7, dx: 39, dy: 14, size: 3 },
  { left: 24.3, top: 22.9, delay: 1.2, dur: 7.5, dx: -26, dy: 30, size: 3 },
  { left: 81.5, top: 16.3, delay: 2.3, dur: 7.8, dx: -26, dy: -22, size: 4 },
  { left: 11.2, top: 87.4, delay: 4.3, dur: 6.9, dx: -33, dy: -34, size: 3 },
  { left: 17.2, top: 83.8, delay: 4.8, dur: 5.6, dx: 31, dy: 15, size: 5 },
  { left: 15.3, top: 7.2, delay: 5.8, dur: 7.6, dx: -25, dy: -30, size: 3 },
  { left: 5.6, top: 24.3, delay: 3.0, dur: 8.1, dx: 21, dy: 30, size: 3 },
];

const SPARK_CSS = `
@keyframes krcFloat {
  0%   { transform: translate(0, 0) scale(1); }
  25%  { transform: translate(calc(var(--dx) * 0.6px), calc(var(--dy) * -0.7px)) scale(1.05); }
  50%  { transform: translate(calc(var(--dx) * 1px), calc(var(--dy) * 0.4px)) scale(0.95); }
  75%  { transform: translate(calc(var(--dx) * 0.3px), calc(var(--dy) * 1px)) scale(1.04); }
  100% { transform: translate(0, 0) scale(1); }
}
@keyframes krcGlow {
  0%,100% { opacity: 0.25; filter: brightness(0.9); }
  50%     { opacity: 1; filter: brightness(1.7); }
}
.krc-spark {
  position: absolute;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 35%, #FFF6CC 0%, #FFD66B 40%, #FFB02E 72%, rgba(255,176,46,0) 100%);
  box-shadow: 0 0 6px 1px rgba(255,200,90,0.9), 0 0 14px 4px rgba(255,150,30,0.45);
  animation-name: krcFloat, krcGlow;
  animation-timing-function: ease-in-out, ease-in-out;
  animation-iteration-count: infinite, infinite;
  animation-direction: alternate, normal;
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
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                ["--dx" as string]: `${s.dx}`,
                ["--dy" as string]: `${s.dy}`,
                animationDuration: `${s.dur}s, ${(s.dur * 0.7).toFixed(1)}s`,
                animationDelay: `${s.delay}s, ${s.delay}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <Card className="w-full overflow-hidden rounded-2xl border-2 border-white/70 p-0 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-black/10">
          <div className="bg-[#0033A0] px-6 py-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/krc-logo-white.png" alt="한국농어촌공사" className="mx-auto h-8 w-auto" />
            <div className="mt-4 text-xl font-extrabold tracking-tight text-white">KRC 건설공사실록</div>
            <div className="mt-1 text-xs text-white/70">동영상 기록관리 플랫폼</div>
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
