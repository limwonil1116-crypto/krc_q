"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isInApp(ua: string) {
  return /KAKAOTALK|FBAN|FBAV|Instagram|Line|NAVER|DaumApps|Snapchat|wv/i.test(ua);
}
function isAndroid(ua: string) {
  return /Android/i.test(ua);
}
function isIOS(ua: string) {
  return /iPhone|iPad|iPod/i.test(ua);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallHelper() {
  const [ua, setUa] = useState("");
  const [showInApp, setShowInApp] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);
  const [androidGuide, setAndroidGuide] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = navigator.userAgent || "";
    setUa(u);
    if (isStandalone()) return; // 이미 설치 실행 중이면 안내 불필요
    if (isInApp(u)) {
      setShowInApp(true);
      // 안드로이드: 카카오 등 인앱이면 크롬으로 자동 열기 시도
      if (isAndroid(u)) {
        try {
          const url = window.location.href.replace(/^https?:\/\//, "");
          const intent =
            "intent://" +
            url +
            "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
            encodeURIComponent(window.location.href) +
            ";end";
          window.location.href = intent;
        } catch {
          // 무시 (버튼으로 수동 시도 가능)
        }
      }
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function openInChrome() {
    const url = window.location.href.replace(/^https?:\/\//, "");
    const intent =
      "intent://" +
      url +
      "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
      encodeURIComponent(window.location.href) +
      ";end";
    window.location.href = intent;
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 미지원
    }
  }

  async function install() {
    if (!deferred) {
      if (isIOS(ua)) setIosGuide(true);
      else if (isAndroid(ua)) setAndroidGuide(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (isStandalone() || installed) return null;

  return (
    <>
      {/* 인앱 브라우저 안내 배너 */}
      {showInApp && (
        <div className="fixed inset-x-0 top-0 z-50 bg-[#0033A0] px-4 py-3 text-white shadow-lg">
          <div className="mx-auto flex max-w-sm flex-col gap-2">
            <p className="text-sm font-semibold">
              ⚠️ 카카오톡 등 인앱 브라우저에서는 일부 기능이 제한됩니다.
            </p>
            {isAndroid(ua) ? (
              <button
                onClick={openInChrome}
                className="rounded-md bg-white px-3 py-2 text-sm font-bold text-[#0033A0]"
              >
                크롬으로 열기
              </button>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-white/90">
                  오른쪽 위 ··· 메뉴 → <b>“다른 브라우저로 열기”</b> 또는 <b>Safari</b>로 열어주세요.
                </p>
                <button
                  onClick={copyUrl}
                  className="rounded-md bg-white px-3 py-2 text-sm font-bold text-[#0033A0]"
                >
                  {copied ? "주소 복사됨!" : "주소 복사하기"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 설치 버튼 (우상단 고정) */}
      {!showInApp && (deferred || isIOS(ua) || isAndroid(ua)) && (
        <div className="fixed bottom-4 right-3 z-50 flex flex-col items-end gap-1">
          <button
            onClick={install}
            className="flex items-center gap-1.5 rounded-full bg-[#FE5000] px-3 py-2 text-xs font-bold text-white shadow-lg ring-2 ring-white/50 hover:bg-[#E04800]"
          >
            📲 앱 설치
          </button>
          {iosGuide && (
            <p className="max-w-[200px] rounded-lg bg-black/70 px-2 py-1 text-right text-[11px] text-white">
              Safari 하단 <b>공유</b> → <b>“홈 화면에 추가”</b>
            </p>
          )}
          {androidGuide && (
            <p className="max-w-[210px] rounded-lg bg-black/70 px-2 py-1 text-right text-[11px] text-white">
              크롬 우측 상단 <b>⋮</b> → <b>“앱 설치”</b> 또는 <b>“홈 화면에 추가”</b>
            </p>
          )}
        </div>
      )}
    </>
  );
}
