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
function isSafari(ua: string) {
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|KAKAOTALK|FBAN|FBAV|Instagram|Line|NAVER|DaumApps/i.test(ua);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function chromeIntent(href: string) {
  const url = href.replace(/^https?:\/\//, "");
  return (
    "intent://" +
    url +
    "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
    encodeURIComponent(href) +
    ";end"
  );
}

export function InstallHelper() {
  const [ua, setUa] = useState("");
  const [iosSheet, setIosSheet] = useState(false);
  const [iosInApp, setIosInApp] = useState(false);
  const [androidGuide, setAndroidGuide] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = navigator.userAgent || "";
    setUa(u);
    if (isStandalone()) return;

    if (isInApp(u) && isAndroid(u)) {
      try {
        window.location.href = chromeIntent(window.location.href);
      } catch {
        // fallback to install button
      }
      return;
    }

    if (isInApp(u) && isIOS(u)) {
      setIosInApp(true);
    }

    if (isIOS(u) && isSafari(u) && !isInApp(u)) {
      setIosSheet(true);
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

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    if (isIOS(ua)) setIosSheet(true);
    else if (isAndroid(ua)) setAndroidGuide(true);
  }

  if (isStandalone() || installed) return null;

  return (
    <>
      {/* iOS 인앱 브라우저(카카오톡/인스타 등): Safari로 열도록 안내 */}
      {iosInApp && (
        <div className="fixed inset-x-0 top-0 z-50 bg-[#0033A0] px-4 py-3 text-white shadow-lg">
          <div className="mx-auto flex max-w-sm flex-col gap-2">
            <p className="text-sm font-semibold">
              📲 Safari로 열어야 홈 화면에 추가할 수 있어요
            </p>
            <p className="text-xs text-white/90">
              오른쪽 위 <b>···</b> 또는 하단 메뉴에서 <b>Safari로 열기</b>를 눌러주세요. 안 보이면 아래 버튼으로 주소를 복사한 뒤 Safari 주소창에 붙여넣으세요.
            </p>
            <button
              onClick={copyUrl}
              className="rounded-md bg-white px-3 py-2 text-sm font-bold text-[#0033A0]"
            >
              {copied ? "주소 복사됨 · Safari에 붙여넣기" : "주소 복사하기"}
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari: 홈 화면에 추가하는 방법 안내 시트 */}
      {iosSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setIosSheet(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/apple-touch-icon.png" alt="앱 아이콘" className="h-12 w-12 rounded-xl" />
              <div>
                <div className="font-bold text-[#0A2540]">홈 화면에 추가</div>
                <div className="text-xs text-neutral-500">KRC 건설공사실록을 앱처럼 사용하세요</div>
              </div>
            </div>
            <ol className="space-y-2.5 text-sm text-neutral-700">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0033A0] text-xs font-bold text-white">1</span>
                <span>Safari 하단(또는 상단)의 <b>공유 버튼</b> <span className="inline-block">⬆️</span> 을 누릅니다</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0033A0] text-xs font-bold text-white">2</span>
                <span>메뉴를 내려 <b>&ldquo;홈 화면에 추가&rdquo;</b> 를 선택합니다</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0033A0] text-xs font-bold text-white">3</span>
                <span>오른쪽 위 <b>추가</b> 를 누르면 바탕화면에 아이콘 생성 완료!</span>
              </li>
            </ol>
            <button
              onClick={() => setIosSheet(false)}
              className="mt-4 w-full rounded-lg bg-[#0033A0] py-2.5 text-sm font-bold text-white"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}

      {/* 설치 플로팅 버튼 (인앱 아닐 때) */}
      {!iosInApp && (deferred || isIOS(ua) || isAndroid(ua)) && (
        <div className="fixed bottom-4 right-3 z-40 flex flex-col items-end gap-1">
          <button
            onClick={install}
            className="flex items-center gap-1.5 rounded-full bg-[#FE5000] px-3 py-2 text-xs font-bold text-white shadow-lg ring-2 ring-white/50 hover:bg-[#E04800]"
          >
            📥 홈 화면에 추가
          </button>
          {androidGuide && (
            <p className="max-w-[210px] rounded-lg bg-black/70 px-2 py-1 text-right text-[11px] text-white">
              브라우저 우측 상단 <b>⋮</b> → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>
            </p>
          )}
        </div>
      )}
    </>
  );
}
