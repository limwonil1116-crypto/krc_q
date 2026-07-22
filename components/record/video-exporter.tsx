"use client";

import { useEffect, useRef, useState } from "react";

export type ExportSlide =
  | { kind: "title" }
  | { kind: "location"; address: string; lat: number; lng: number; content: string | null; part: string | null; mapSrc: string | null }
  | { kind: "section"; label: string; text: string | null }
  | { kind: "image"; src: string; caption: string; description?: string | null }
  | { kind: "video"; src: string; caption: string; description?: string | null };

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

function loadVideo(src: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    const done = () => resolve(v);
    v.onloadeddata = done;
    v.oncanplay = done;
    v.onerror = () => resolve(null);
  });
}

export function VideoExporter({
  slides,
  meta,
  date,
  fileBase,
  siteStructureId,
  canSave,
  autoSave,
}: {
  slides: ExportSlide[];
  meta: ExportMeta;
  date: string;
  fileBase: string;
  siteStructureId?: string;
  canSave?: boolean;
  autoSave?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");
  const cancelRef = useRef(false);
  const autoRan = useRef(false);

  useEffect(() => {
    if (autoSave && canSave && siteStructureId && slides.length > 0 && !autoRan.current) {
      autoRan.current = true;
      // 자동: 다운로드 없이 드라이브 저장만
      exportVideo(true, { download: false, upload: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, canSave, siteStructureId, slides.length]);

  function drawBackground(ctx: CanvasRenderingContext2D, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
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
    ctx.fillStyle = "#fff";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("KRC 건설공사실록", W / 2, 250);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 90, 282, 180, 6);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(meta.structureName, W / 2, 360);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "26px sans-serif";
    const sub = meta.projectName + (meta.districtName ? ` · ${meta.districtName}` : "");
    ctx.fillText(sub, W / 2, 410);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "20px sans-serif";
    ctx.fillText(meta.address, W / 2, 446);
    // 하단 4칸 정보 바
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H - 70, W, 70);
    const cols = [
      ["공종", meta.workType || "-"],
      ["시행자", meta.executor || "-"],
      ["시공사", meta.contractorCompany || "-"],
      ["구조물", meta.typeName || "-"],
    ];
    cols.forEach((c, i) => {
      const cx = W / 8 + (i * W) / 4;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "15px sans-serif";
      ctx.fillText(c[0], cx, H - 44);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      const v = wrapText(ctx, c[1], W / 4 - 24)[0] || c[1];
      ctx.fillText(v, cx, H - 20);
    });
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("한국농어촌공사 · CONSTRUCTION INSPECTION RECORD", 44, 22);
    ctx.textAlign = "right";
    ctx.fillText(`검측일자 ${date}`, W - 44, 22);
  }

  function drawLocation(ctx: CanvasRenderingContext2D, address: string, lat: number, lng: number, content: string | null, part: string | null, mapImg: HTMLImageElement | null) {
    // 지도 전체 배경 (cover 방식)
    if (mapImg) {
      const iw = mapImg.naturalWidth || mapImg.width;
      const ih = mapImg.naturalHeight || mapImg.height;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (W - dw) / 2, dy = (H - dh) / 2;
      try { ctx.drawImage(mapImg, dx, dy, dw, dh); } catch { drawBackground(ctx, "#002A80"); }
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, W, H);
    } else {
      drawBackground(ctx, "#002A80");
    }
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(24, 60); ctx.lineTo(24, 24); ctx.lineTo(60, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 24, H - 60); ctx.lineTo(W - 24, H - 24); ctx.lineTo(W - 60, H - 24); ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("📍 검측 위치", 44, 76);
    const boxH = 300;
    const boxY = H - boxH - 40;
    const boxX = 40, boxW = W - 80;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 18); ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
    }
    ctx.textAlign = "left";
    let ty = boxY + 60;
    const tx = boxX + 36;
    if (address) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 34px sans-serif";
      const lines = wrapText(ctx, address, boxW - 72).slice(0, 2);
      lines.forEach((ln) => { ctx.fillText(ln, tx, ty); ty += 44; });
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "22px sans-serif";
    ty += 4;
    ctx.fillText(`좌표  ${lat.toFixed(6)},  ${lng.toFixed(6)}`, tx, ty);
    if (content) {
      ty += 50;
      ctx.fillStyle = "#FFB68A";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("검측내용", tx, ty);
      ctx.fillStyle = "#fff";
      ctx.font = "26px sans-serif";
      const clines = wrapText(ctx, content, boxW - 220).slice(0, 2);
      let cy = ty;
      clines.forEach((ln) => { ctx.fillText(ln, tx + 150, cy); cy += 34; });
      ty = Math.max(ty, cy - 34);
    }
    if (part) {
      ty += 44;
      ctx.fillStyle = "#FFB68A";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("검측부위", tx, ty);
      ctx.fillStyle = "#fff";
      ctx.font = "26px sans-serif";
      ctx.fillText(part, tx + 150, ty);
    }
    ctx.textAlign = "center";
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

  function drawMediaFrame(
    ctx: CanvasRenderingContext2D,
    src: CanvasImageSource,
    iw: number,
    ih: number,
    caption: string,
    description?: string | null
  ) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const scale = Math.min(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = "rgba(0,51,160,0.85)";
    ctx.fillRect(24, 24, 360, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`KRC 건설공사실록 · ${date}`, 36, 48);
    // 설명(F2·F3 텍스트)이 있으면 자막 영역을 키워 여러 줄 표시
    const desc = (description || "").trim();
    const boxH = desc ? 200 : 90;
    const grad = ctx.createLinearGradient(0, H - boxH, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.35, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - boxH, W, boxH);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(36, H - boxH + 30, 6, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(caption, 56, H - boxH + 52);
    if (desc) {
      ctx.font = "22px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      // 단어 단위 줄바꿈 (최대 4줄)
      const maxWidth = W - 72;
      const words = desc.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > maxWidth && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
        if (lines.length >= 4) break;
      }
      if (cur && lines.length < 4) lines.push(cur);
      let ly = H - boxH + 88;
      for (const line of lines.slice(0, 4)) {
        ctx.fillText(line, 56, ly);
        ly += 30;
      }
    }
  }

  async function exportVideo(withBgm: boolean, opts?: { download?: boolean; upload?: boolean }) {
    const doDownload = opts?.download !== false;
    const doUpload = !!opts?.upload && !!siteStructureId;
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

      setMsg("미디어 불러오는 중...");
      const media: (HTMLImageElement | HTMLVideoElement | null)[] = [];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (s.kind === "image") media[i] = await loadImage(s.src);
        else if (s.kind === "video") media[i] = await loadVideo(s.src);
        else if (s.kind === "location" && s.mapSrc) media[i] = await loadImage(s.mapSrc).catch(() => null);
        else media[i] = null;
        setProgress(Math.round(((i + 1) / slides.length) * 15));
      }

      const stream = canvas.captureStream(FPS);

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
          // ignore
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

      // 총 길이 추정(진행률용): 영상은 실제 길이 사용
      const durations = slides.map((s, i) => {
        if (s.kind === "title") return TITLE_SEC;
        if (s.kind === "location") return SECTION_SEC;
        if (s.kind === "section") return SECTION_SEC;
        if (s.kind === "image") return IMAGE_SEC;
        const v = media[i] as HTMLVideoElement | null;
        return v && v.duration && isFinite(v.duration) ? v.duration : IMAGE_SEC;
      });
      const totalSec = durations.reduce((a, b) => a + b, 0) || 1;
      let elapsed = 0;
      const frameMs = 1000 / FPS;

      for (let i = 0; i < slides.length; i++) {
        if (cancelRef.current) break;
        const s = slides[i];
        setMsg(`녹화 중... (${i + 1}/${slides.length})`);

        if (s.kind === "video" && media[i]) {
          // 실제 영상 재생하며 프레임 캡처
          const v = media[i] as HTMLVideoElement;
          try {
            v.currentTime = 0;
            await v.play().catch(() => {});
          } catch {
            // ignore
          }
          await new Promise<void>((resolve) => {
            const tick = () => {
              if (cancelRef.current || v.ended || (v.duration && v.currentTime >= v.duration - 0.05)) {
                resolve();
                return;
              }
              const iw = v.videoWidth || W;
              const ih = v.videoHeight || H;
              drawMediaFrame(ctx, v, iw, ih, s.caption, "description" in s ? s.description : null);
              elapsed += 1 / FPS;
              setProgress(15 + Math.round((elapsed / totalSec) * 83));
              setTimeout(tick, frameMs);
            };
            tick();
          });
          try {
            v.pause();
          } catch {
            // ignore
          }
        } else {
          // 고정 길이 슬라이드 (title/section/image)
          const dur = durations[i];
          const frames = Math.max(1, Math.round(dur * FPS));
          for (let fr = 0; fr < frames; fr++) {
            if (cancelRef.current) break;
            if (s.kind === "title") drawTitle(ctx);
            else if (s.kind === "location") drawLocation(ctx, s.address, s.lat, s.lng, s.content, s.part, media[i] as HTMLImageElement | null);
            else if (s.kind === "section") drawSection(ctx, s.label, s.text);
            else {
              const m = media[i] as HTMLImageElement | null;
              if (m) drawMediaFrame(ctx, m, m.naturalWidth || W, m.naturalHeight || H, s.caption, "description" in s ? s.description : null);
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
            setProgress(15 + Math.round((elapsed / totalSec) * 83));
          }
        }
      }

      recorder.stop();
      const blob = await done;
      if (audioCtx) audioCtx.close();

      if (doDownload) {
        setMsg("파일 생성 중...");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileBase}_${date}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      if (doUpload && siteStructureId) {
        setMsg("드라이브에 저장 중...");
        try {
          const form = new FormData();
          form.append("siteStructureId", siteStructureId);
          form.append("inspectionDate", date);
          form.append("file", new File([blob], `${fileBase}_${date}.webm`, { type: "video/webm" }));
          const res = await fetch("/api/records/video", { method: "POST", body: form });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d.ok) {
            setMsg("드라이브 저장 실패: " + (d.error || res.status));
            alert("드라이브 저장 실패: " + (d.error || res.status));
          } else {
            setMsg(doDownload ? "완료! 다운로드 + 드라이브 저장됨." : "드라이브에 저장되었습니다.");
          }
        } catch (e) {
          setMsg("드라이브 저장 오류: " + (e instanceof Error ? e.message : "네트워크"));
        }
      } else {
        setMsg(doDownload ? "완료! 다운로드가 시작됩니다." : "완료되었습니다.");
      }
      setProgress(100);
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
        {canSave && siteStructureId && (
          <button
            type="button"
            disabled={busy || slides.length === 0}
            onClick={() => exportVideo(true, { download: false, upload: true })}
            className="rounded-md bg-[#0033A0] px-4 py-2 text-sm font-bold text-white hover:bg-[#002A80] disabled:opacity-50"
          >
            💾 드라이브에 저장
          </button>
        )}
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
        동영상 클립은 실제 재생되어 포함됩니다(영상 자체 소리는 제외, BGM만 선택 가능).
        {" "}PC 크롬 권장(아이폰은 미지원일 수 있음).
      </p>
    </div>
  );
}
