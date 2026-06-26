"use client";

import { useRef, useState } from "react";

export type ExportSlide =
  | { kind: "title" }
  | { kind: "section"; label: string; text: string | null }
  | { kind: "image"; src: string; caption: string }
  | { kind: "video"; src: string; caption: string };

export type ExportMeta = {
  projectName: string;
  districtName: string;
  address: string;
  workType: string | null;
  executor: string | null;
  structureName: string;
  typeName: string;
  contractorCompany: string | null;
};

const W = 1280;
const H = 720;
const BLUE = "#0033A0";
const DARKBLUE = "#001A52";
const ORANGE = "#FE5000";

const TITLE_SEC = 3.5;
const SECTION_SEC = 2.2;
const IMAGE_SEC = 3.0;
const FPS = 30;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function captureVideoFrame(src: string): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.src = src;
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.1, v.duration || 0.1);
    };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth || W;
      c.height = v.videoHeight || H;
      const cx = c.getContext("2d");
      if (cx) cx.drawImage(v, 0, 0, c.width, c.height);
      resolve(c);
    };
    v.onerror = () => resolve(null);
  });
}

export function VideoExporter({
  slides,
  meta,
  date,
  fileBase,
}: {
  slides: ExportSlide[];
  meta: ExportMeta;
  date: string;
  fileBase: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");
  const cancelRef = useRef(false);

  function drawBackground(ctx: CanvasRenderingContext2D, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    // 격자
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // 코너 마커
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 4;
    const m = 28;
    const len = 36;
    ctx.beginPath();
    ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
    ctx.moveTo(W - m - len, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + len);
    ctx.moveTo(m, H - m - len); ctx.lineTo(m, H - m); ctx.lineTo(m + len, H - m);
    ctx.moveTo(W - m - len, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - len);
    ctx.stroke();
  }

  function drawTitle(ctx: CanvasRenderingContext2D) {
    drawBackground(ctx, DARKBLUE);
    ctx.textAlign = "center";
    // 제목
    ctx.fillStyle = "#fff";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("KRC 건설공사실록", W / 2, 250);
    // 주황 라인
    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 90, 282, 180, 6);
    // 구조물명
    ctx.fillStyle = "#fff";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(meta.structureName, W / 2, 360);
    // 사업/지구
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "26px sans-serif";
    const sub = meta.projectName + (meta.districtName ? ` · ${meta.districtName}` : "");
    ctx.fillText(sub, W / 2, 410);
    // 주소
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "20px sans-serif";
    ctx.fillText(meta.address, W / 2, 446);
    // 하단 정보 바
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    const cols = [
      ["공종", meta.workType || meta.typeName || "-"],
      ["시행자", meta.executor || "-"],
      [meta.contractorCompany ? "시공사" : "구조물", meta.contractorCompany || meta.typeName || "-"],
    ];
    cols.forEach((c, i) => {
      const cx = W / 6 + (i * W) / 3;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "15px sans-serif";
      ctx.fillText(c[0], cx, H - 44);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(c[1], cx, H - 20);
    });
    // 상단 라벨
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("한국농어촌공사 · CONSTRUCTION INSPECTION RECORD", 44, 22);
    ctx.textAlign = "right";
    ctx.fillText(`검측일자 ${date}`, W - 44, 22);
  }

  function drawSection(ctx: CanvasRenderingContext2D, label: string, text: string | null) {
    drawBackground(ctx, "#002A80");
    ctx.textAlign = "center";
    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 60, 250, 120, 6);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 60px sans-serif";
    const labelLines = wrapText(ctx, label, W - 200);
    let y = 330;
    labelLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, y);
      y += 72;
    });
    if (text) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "26px sans-serif";
      const lines = wrapText(ctx, text, W - 320).slice(0, 5);
      y += 10;
      lines.forEach((ln) => {
        ctx.fillText(ln, W / 2, y);
        y += 38;
      });
    }
  }

  function drawImageSlide(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | HTMLCanvasElement,
    caption: string
  ) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
    const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
    const scale = Math.min(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    // 상단 워터마크
    ctx.fillStyle = "rgba(0,51,160,0.85)";
    ctx.fillRect(24, 24, 360, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`KRC 건설공사실록 · ${date}`, 36, 48);
    // 하단 캡션 바
    const grad = ctx.createLinearGradient(0, H - 90, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(36, H - 52, 6, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(caption, 56, H - 30);
  }

  async function exportVideo(withBgm: boolean) {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    setMsg("준비 중...");
    cancelRef.current = false;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 미지원");

      // 미리 이미지/영상프레임 로드
      setMsg("이미지 불러오는 중...");
      const media: (HTMLImageElement | HTMLCanvasElement | null)[] = [];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (s.kind === "image") media[i] = await loadImage(s.src);
        else if (s.kind === "video") media[i] = await captureVideoFrame(s.src);
        else media[i] = null;
        setProgress(Math.round(((i + 1) / slides.length) * 20));
      }

      const stream = canvas.captureStream(FPS);

      // BGM 합성 (선택)
      let audioCtx: AudioContext | null = null;
      if (withBgm) {
        try {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new Ctor();
          const dest = audioCtx.createMediaStreamDestination();
          const master = audioCtx.createGain();
          master.gain.value = 0.06;
          master.connect(dest);
          const freqs = [110, 164.81, 220, 277.18];
          freqs.forEach((f, i) => {
            const o = audioCtx!.createOscillator();
            o.type = i === 0 ? "sine" : "triangle";
            o.frequency.value = f;
            const g = audioCtx!.createGain();
            g.gain.value = i === 0 ? 0.5 : 0.22;
            o.connect(g);
            g.connect(master);
            o.start();
          });
          dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        } catch {
          // 오디오 실패 무시
        }
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start();

      // 슬라이드별 지속시간(초)
      const durations = slides.map((s) =>
        s.kind === "title" ? TITLE_SEC : s.kind === "section" ? SECTION_SEC : IMAGE_SEC
      );
      const totalSec = durations.reduce((a, b) => a + b, 0);
      let elapsed = 0;
      const frameMs = 1000 / FPS;

      for (let i = 0; i < slides.length; i++) {
        if (cancelRef.current) break;
        const s = slides[i];
        const dur = durations[i];
        const frames = Math.max(1, Math.round(dur * FPS));
        setMsg(`녹화 중... (${i + 1}/${slides.length})`);
        for (let fr = 0; fr < frames; fr++) {
          if (cancelRef.current) break;
          if (s.kind === "title") drawTitle(ctx);
          else if (s.kind === "section") drawSection(ctx, s.label, s.text);
          else {
            const m = media[i];
            if (m) drawImageSlide(ctx, m, s.kind === "image" || s.kind === "video" ? s.caption : "");
            else {
              drawBackground(ctx, "#111");
              ctx.fillStyle = "#fff";
              ctx.font = "24px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("(미디어를 불러오지 못했습니다)", W / 2, H / 2);
            }
          }
          await new Promise((r) => setTimeout(r, frameMs));
          elapsed += 1 / FPS;
          setProgress(20 + Math.round((elapsed / totalSec) * 78));
        }
      }

      recorder.stop();
      const blob = await done;
      if (audioCtx) audioCtx.close();

      setMsg("파일 생성 중...");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}_${date}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setProgress(100);
      setMsg("완료! 다운로드가 시작됩니다.");
    } catch (e) {
      setMsg("실패: " + (e instanceof Error ? e.message : "오류"));
    } finally {
      setBusy(false);
      setTimeout(() => {
        setProgress(0);
        setMsg("");
      }, 4000);
    }
  }

  const hasVideo = slides.some((s) => s.kind === "video");

  return (
    <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || slides.length === 0}
          onClick={() => exportVideo(false)}
          className="rounded-md bg-[#FE5000] px-4 py-2 text-sm font-bold text-white hover:bg-[#E04800] disabled:opacity-50"
        >
          🎥 영상 다운로드
        </button>
        <button
          type="button"
          disabled={busy || slides.length === 0}
          onClick={() => exportVideo(true)}
          className="rounded-md border border-[#0033A0] px-4 py-2 text-sm font-bold text-[#0033A0] hover:bg-[#EAF0FB] disabled:opacity-50"
        >
          🎵 BGM 포함 다운로드
        </button>
        {busy && (
          <button
            type="button"
            onClick={() => (cancelRef.current = true)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            취소
          </button>
        )}
      </div>

      {(busy || progress > 0) && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-[#0033A0] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-neutral-500">{msg}</p>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        브라우저에서 직접 영상을 만들어 WebM 파일로 저장합니다. 녹화 중 탭을 닫지 마세요.
        {hasVideo && " 동영상 클립은 대표 화면 한 장으로 포함됩니다."}
        {" "}PC 크롬 권장(아이폰은 미지원일 수 있음).
      </p>
    </div>
  );
}
