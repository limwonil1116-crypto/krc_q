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
  { left: 17.8, top: 67.1, delay: 4.4, dur: 6.4, dx: -38, dy: 33, size: 6 },
  { left: 19.6, top: 52.1, delay: 5.5, dur: 4.6, dx: 14, dy: -36, size: 7 },
  { left: 6.1, top: 95.8, delay: 5.2, dur: 8.0, dx: 13, dy: 26, size: 7 },
  { left: 13.1, top: 91.5, delay: 2.6, dur: 5.1, dx: -15, dy: -24, size: 6 },
  { left: 71.9, top: 40.3, delay: 1.1, dur: 7.2, dx: 35, dy: -14, size: 4 },
  { left: 22.0, top: 93.1, delay: 6.3, dur: 7.5, dx: -15, dy: 27, size: 5 },
  { left: 21.3, top: 88.9, delay: 6.2, dur: 6.1, dx: 37, dy: 20, size: 5 },
  { left: 39.1, top: 5.5, delay: 0.7, dur: 7.4, dx: 12, dy: -26, size: 7 },
  { left: 52.1, top: 56.2, delay: 2.2, dur: 8.4, dx: -17, dy: -28, size: 5 },
  { left: 35.3, top: 58.5, delay: 2.1, dur: 4.9, dx: -36, dy: -32, size: 5 },
  { left: 17.3, top: 6.4, delay: 3.6, dur: 7.1, dx: -23, dy: -37, size: 6 },
  { left: 3.4, top: 35.2, delay: 3.5, dur: 7.2, dx: -16, dy: -23, size: 5 },
  { left: 76.3, top: 47.9, delay: 5.9, dur: 4.7, dx: 29, dy: -23, size: 4 },
  { left: 39.9, top: 83.9, delay: 4.5, dur: 5.1, dx: -31, dy: 13, size: 4 },
  { left: 94.1, top: 51.9, delay: 5.1, dur: 4.6, dx: -35, dy: 33, size: 5 },
  { left: 59.7, top: 42.6, delay: 4.1, dur: 7.9, dx: 16, dy: 16, size: 7 },
  { left: 3.0, top: 66.7, delay: 6.7, dur: 4.6, dx: 29, dy: 19, size: 5 },
  { left: 74.2, top: 78.5, delay: 1.0, dur: 5.1, dx: 14, dy: -29, size: 4 },
  { left: 8.9, top: 14.1, delay: 2.0, dur: 5.7, dx: 22, dy: -28, size: 4 },
  { left: 19.7, top: 38.1, delay: 5.0, dur: 6.7, dx: -28, dy: -33, size: 4 },
  { left: 39.2, top: 83.4, delay: 2.8, dur: 6.8, dx: -19, dy: 31, size: 4 },
  { left: 39.3, top: 31.8, delay: 6.3, dur: 5.7, dx: 37, dy: -26, size: 4 },
  { left: 50.8, top: 71.3, delay: 6.8, dur: 5.7, dx: -14, dy: 37, size: 5 },
  { left: 8.3, top: 64.2, delay: 2.9, dur: 8.0, dx: -28, dy: 25, size: 4 },
  { left: 67.3, top: 68.6, delay: 3.3, dur: 6.6, dx: 14, dy: -13, size: 5 },
  { left: 6.0, top: 28.6, delay: 4.1, dur: 6.1, dx: 24, dy: -22, size: 5 },
  { left: 48.7, top: 61.8, delay: 6.7, dur: 4.8, dx: 16, dy: 31, size: 4 },
  { left: 76.8, top: 61.3, delay: 5.3, dur: 7.2, dx: 18, dy: 22, size: 6 },
  { left: 38.7, top: 51.8, delay: 5.0, dur: 8.1, dx: -20, dy: 35, size: 7 },
  { left: 16.0, top: 54.5, delay: 0.6, dur: 5.7, dx: 31, dy: 38, size: 4 },
  { left: 69.6, top: 22.1, delay: 2.3, dur: 7.1, dx: -19, dy: -20, size: 5 },
  { left: 92.7, top: 92.9, delay: 6.3, dur: 6.5, dx: -28, dy: 31, size: 4 },
  { left: 92.3, top: 46.4, delay: 3.1, dur: 7.0, dx: 29, dy: 28, size: 4 },
  { left: 20.1, top: 92.4, delay: 0.2, dur: 7.7, dx: 12, dy: -22, size: 5 },
  { left: 69.2, top: 25.3, delay: 0.1, dur: 6.7, dx: -37, dy: -24, size: 4 },
  { left: 37.5, top: 15.6, delay: 5.5, dur: 7.8, dx: -20, dy: 22, size: 6 },
  { left: 25.5, top: 56.5, delay: 5.8, dur: 6.8, dx: 35, dy: -29, size: 4 },
  { left: 9.7, top: 86.7, delay: 5.2, dur: 7.5, dx: -16, dy: 33, size: 6 },
  { left: 53.4, top: 48.7, delay: 4.8, dur: 7.2, dx: -19, dy: 19, size: 7 },
  { left: 62.2, top: 85.8, delay: 0.5, dur: 4.8, dx: -30, dy: -21, size: 5 },
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
  0%,100% { opacity: 0.45; filter: brightness(1.05); }
  50%     { opacity: 1; filter: brightness(1.9); }
}
.krc-spark {
  position: absolute;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 35%, #FFFBE6 0%, #FFE08A 38%, #FFC24B 70%, rgba(255,194,75,0) 100%);
  box-shadow: 0 0 10px 2px rgba(255,210,110,0.95), 0 0 22px 7px rgba(255,170,50,0.5);
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
        <Card className="w-full overflow-hidden rounded-2xl border border-white/40 !bg-white/55 p-0 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/20 backdrop-blur-lg">
          <div className="bg-[#0033A0]/90 px-6 py-8 text-center backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/krc-logo-white.png" alt="한국농어촌공사" className="mx-auto h-8 w-auto" />
            <div className="mt-4 text-xl font-extrabold tracking-tight text-white">KRC 건설공사실록</div>
            <div className="mt-1 text-xs text-white/70">동영상 기록관리 플랫폼</div>
          </div>
          <CardContent className="space-y-4 !bg-transparent p-6">
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
