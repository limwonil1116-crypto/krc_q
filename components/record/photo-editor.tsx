"use client";

import { useEffect, useRef, useState } from "react";

type Tool = "pen" | "eraser" | "text" | "arrow" | "rect" | "ellipse";
type Pt = { x: number; y: number };

const COLORS = ["#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#0033A0", "#000000", "#FFFFFF"];
const WIDTHS = [3, 6, 12, 20];
const FONTS = [24, 36, 52, 72];

export function PhotoEditor({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (edited: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLImageElement | null>(null);
  // 편집 누적 레이어(투명) - 원본 위에 그림
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [fontSize, setFontSize] = useState(FONTS[1]);
  const [ready, setReady] = useState(false);
  const drawing = useRef(false);
  const startPt = useRef<Pt | null>(null);
  const snapshot = useRef<ImageData | null>(null);

  // 이미지 로드 + canvas 셋업
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      baseRef.current = img;
      const maxW = 1280;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const c = canvasRef.current!;
      c.width = w;
      c.height = h;
      const layer = document.createElement("canvas");
      layer.width = w;
      layer.height = h;
      layerRef.current = layer;
      render();
      pushHistory();
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function render() {
    const c = canvasRef.current;
    const img = baseRef.current;
    const layer = layerRef.current;
    if (!c || !img || !layer) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.drawImage(layer, 0, 0);
  }

  function pushHistory() {
    const layer = layerRef.current;
    if (!layer) return;
    const lctx = layer.getContext("2d")!;
    historyRef.current.push(lctx.getImageData(0, 0, layer.width, layer.height));
    if (historyRef.current.length > 30) historyRef.current.shift();
  }

  function undo() {
    const layer = layerRef.current;
    if (!layer || historyRef.current.length <= 1) {
      // 초기 상태로
      const lctx = layer?.getContext("2d");
      lctx?.clearRect(0, 0, layer!.width, layer!.height);
      render();
      return;
    }
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const lctx = layer.getContext("2d")!;
    lctx.putImageData(prev, 0, 0);
    render();
  }

  function clearAll() {
    const layer = layerRef.current;
    if (!layer) return;
    const lctx = layer.getContext("2d")!;
    lctx.clearRect(0, 0, layer.width, layer.height);
    historyRef.current = [];
    pushHistory();
    render();
  }

  function posFromEvent(e: React.PointerEvent): Pt {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!ready) return;
    const layer = layerRef.current!;
    const lctx = layer.getContext("2d")!;
    const p = posFromEvent(e);

    if (tool === "text") {
      const t = window.prompt("표시할 텍스트를 입력하세요");
      if (t && t.trim()) {
        lctx.save();
        lctx.font = `bold ${fontSize}px sans-serif`;
        lctx.fillStyle = color;
        lctx.strokeStyle = color === "#FFFFFF" ? "#000000" : "#FFFFFF";
        lctx.lineWidth = Math.max(2, fontSize / 12);
        lctx.textBaseline = "top";
        lctx.strokeText(t, p.x, p.y);
        lctx.fillText(t, p.x, p.y);
        lctx.restore();
        pushHistory();
        render();
      }
      return;
    }

    drawing.current = true;
    startPt.current = p;
    snapshot.current = lctx.getImageData(0, 0, layer.width, layer.height);

    if (tool === "pen" || tool === "eraser") {
      lctx.save();
      lctx.lineCap = "round";
      lctx.lineJoin = "round";
      lctx.lineWidth = width;
      if (tool === "eraser") {
        lctx.globalCompositeOperation = "destination-out";
        lctx.lineWidth = width * 2.5;
      } else {
        lctx.strokeStyle = color;
      }
      lctx.beginPath();
      lctx.moveTo(p.x, p.y);
      render();
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current || !ready) return;
    const layer = layerRef.current!;
    const lctx = layer.getContext("2d")!;
    const p = posFromEvent(e);

    if (tool === "pen" || tool === "eraser") {
      lctx.lineTo(p.x, p.y);
      lctx.stroke();
      render();
      return;
    }
    // 도형: 매 이동마다 스냅샷 복원 후 다시 그림(고무줄)
    if (snapshot.current) lctx.putImageData(snapshot.current, 0, 0);
    const s = startPt.current!;
    lctx.save();
    lctx.strokeStyle = color;
    lctx.fillStyle = color;
    lctx.lineWidth = width;
    lctx.lineCap = "round";
    if (tool === "rect") {
      lctx.strokeRect(s.x, s.y, p.x - s.x, p.y - s.y);
    } else if (tool === "ellipse") {
      lctx.beginPath();
      lctx.ellipse((s.x + p.x) / 2, (s.y + p.y) / 2, Math.abs(p.x - s.x) / 2, Math.abs(p.y - s.y) / 2, 0, 0, Math.PI * 2);
      lctx.stroke();
    } else if (tool === "arrow") {
      drawArrow(lctx, s, p, width);
    }
    lctx.restore();
    render();
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const layer = layerRef.current!;
    const lctx = layer.getContext("2d")!;
    if (tool === "pen" || tool === "eraser") lctx.restore();
    pushHistory();
    render();
  }

  function drawArrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, w: number) {
    const headLen = Math.max(14, w * 3);
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLen * Math.cos(ang - Math.PI / 6), to.y - headLen * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(to.x - headLen * Math.cos(ang + Math.PI / 6), to.y - headLen * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function done() {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const name = (file.name || "photo").replace(/\.[^.]+$/, "") + "_edited.jpg";
        onDone(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  const toolBtn = (t: Tool, label: string) =>
    `rounded-md px-2.5 py-1.5 text-sm font-semibold ${
      tool === t ? "bg-[#0033A0] text-white" : "bg-neutral-100 text-neutral-700"
    }`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2 bg-neutral-900 px-3 py-2 text-white">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10">
          취소
        </button>
        <span className="text-sm font-bold">사진 편집</span>
        <button type="button" onClick={done} className="rounded-md bg-[#FE5000] px-4 py-1.5 text-sm font-bold text-white">
          완료
        </button>
      </div>

      {/* 캔버스 */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-2">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="max-h-full max-w-full touch-none rounded bg-white shadow-lg"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* 도구 바 */}
      <div className="space-y-2 bg-neutral-900 px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={toolBtn("pen", "펜")} onClick={() => setTool("pen")}>✏️ 펜</button>
          <button type="button" className={toolBtn("arrow", "화살표")} onClick={() => setTool("arrow")}>↗ 화살표</button>
          <button type="button" className={toolBtn("rect", "사각형")} onClick={() => setTool("rect")}>▭ 사각</button>
          <button type="button" className={toolBtn("ellipse", "원")} onClick={() => setTool("ellipse")}>◯ 원</button>
          <button type="button" className={toolBtn("text", "텍스트")} onClick={() => setTool("text")}>T 글자</button>
          <button type="button" className={toolBtn("eraser", "지우개")} onClick={() => setTool("eraser")}>지우개</button>
          <button type="button" onClick={undo} className="rounded-md bg-neutral-700 px-2.5 py-1.5 text-sm font-semibold text-white">↩ 실행취소</button>
          <button type="button" onClick={clearAll} className="rounded-md bg-neutral-700 px-2.5 py-1.5 text-sm font-semibold text-white">전체지움</button>
        </div>

        {/* 색상 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/60">색상</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={"h-7 w-7 rounded-full border-2 " + (color === c ? "border-white" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* 두께 / 글자크기 */}
        <div className="flex items-center gap-3">
          {tool === "text" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60">글자크기</span>
              {FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFontSize(f)}
                  className={"rounded px-2 py-1 text-xs font-bold " + (fontSize === f ? "bg-white text-black" : "bg-neutral-700 text-white")}
                >
                  {f <= 24 ? "작게" : f <= 36 ? "보통" : f <= 52 ? "크게" : "특대"}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60">두께</span>
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={"flex h-8 w-8 items-center justify-center rounded " + (width === w ? "bg-white" : "bg-neutral-700")}
                >
                  <span className="rounded-full" style={{ width: w, height: w, backgroundColor: width === w ? "#000" : "#fff" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
