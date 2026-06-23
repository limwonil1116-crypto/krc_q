"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = { id: string; code: string; name: string; sortOrder: number };
type Rec = { phaseTemplateId: string; inspectionDate: string | null; title: string | null; textDescription: string | null };
type Asset = {
  id: string;
  phaseTemplateId: string;
  inspectionDate: string | null;
  assetType: string;
  fileName: string;
  mimeType: string;
};
type Meta = {
  projectName: string;
  districtName: string;
  address: string;
  workType: string | null;
  executor: string | null;
  structureName: string;
  typeName: string;
};

type Slide =
  | { kind: "title" }
  | { kind: "section"; label: string; text: string | null }
  | { kind: "image"; src: string; caption: string }
  | { kind: "video"; src: string; caption: string };

const TITLE_MS = 4200;
const SECTION_MS = 2600;
const IMAGE_MS = 3200;

export function VideoComposer({
  meta,
  phases,
  records,
  assets,
  dates,
}: {
  meta: Meta;
  phases: Phase[];
  records: Rec[];
  assets: Asset[];
  dates: string[];
}) {
  const [date, setDate] = useState(dates[0] || "");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const slides = useMemo<Slide[]>(() => {
    if (!date) return [];
    const recMap = new Map(records.filter((r) => r.inspectionDate === date).map((r) => [r.phaseTemplateId, r]));
    const byPhase = new Map<string, Asset[]>();
    assets
      .filter((a) => a.inspectionDate === date)
      .forEach((a) => {
        const arr = byPhase.get(a.phaseTemplateId) || [];
        arr.push(a);
        byPhase.set(a.phaseTemplateId, arr);
      });
    const out: Slide[] = [{ kind: "title" }];
    [...phases]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((p, i) => {
        const r = recMap.get(p.id);
        const list = byPhase.get(p.id) || [];
        const photos = list.filter((a) => a.assetType === "photo");
        const videos = list.filter((a) => a.assetType === "video");
        if (list.length > 0 || (r && r.textDescription)) {
          out.push({ kind: "section", label: `${i + 1}. ${p.name}`, text: r?.textDescription ?? null });
        }
        photos.forEach((a) => out.push({ kind: "image", src: `/api/assets/${a.id}/raw`, caption: p.name }));
        videos.forEach((a) => out.push({ kind: "video", src: `/api/assets/${a.id}/raw`, caption: p.name }));
      });
    return out;
  }, [date, phases, records, assets]);

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [date]);

  const cur = slides[idx];
  const total = slides.length;

  useEffect(() => {
    if (!playing || !cur) return;
    if (cur.kind === "video") return; // 영상은 종료 시 자동 넘김
    const ms = cur.kind === "title" ? TITLE_MS : cur.kind === "section" ? SECTION_MS : IMAGE_MS;
    const t = setTimeout(() => {
      setIdx((i) => {
        if (i + 1 < total) return i + 1;
        setPlaying(false);
        return i;
      });
    }, ms);
    return () => clearTimeout(t);
  }, [playing, idx, cur, total]);

  useEffect(() => {
    if (cur?.kind === "video" && playing && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [idx, playing, cur]);

  function go(n: number) {
    setIdx((i) => Math.min(Math.max(i + n, 0), Math.max(total - 1, 0)));
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold text-[#1E3A5F]">자동 영상 미리보기</h1>
        <p className="text-sm text-neutral-500">{meta.structureName} · {meta.typeName}</p>
      </div>

      {dates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">검측일자</span>
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (d === date ? "bg-[#1E3A5F] text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
              }
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          이 검측일자에 등록된 사진/영상/기록이 없습니다. 단계별 기록에서 먼저 자료를 등록하세요.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
            {cur?.kind === "title" && (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1E3A5F] to-[#0f2238] px-6 text-center text-white">
                <div className="text-xs font-semibold tracking-widest text-[#F37021]">한국농어촌공사 · 현장기록</div>
                <div className="mt-3 text-2xl font-bold">{meta.structureName}</div>
                <div className="mt-2 text-sm text-white/90">
                  {meta.projectName}{meta.districtName ? ` · ${meta.districtName}` : ""}
                </div>
                <div className="mt-1 text-xs text-white/70">{meta.address}</div>
                <div className="mt-1 text-xs text-white/70">
                  {[meta.workType, meta.executor].filter(Boolean).join(" · ")}
                </div>
                <div className="mt-4 rounded-full bg-white/15 px-3 py-1 text-xs">검측일자 {date}</div>
              </div>
            )}

            {cur?.kind === "section" && (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#16304d] to-[#1E3A5F] px-8 text-center text-white">
                <div className="text-3xl font-bold">{cur.label}</div>
                {cur.text && <div className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">{cur.text}</div>}
              </div>
            )}

            {cur?.kind === "image" && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.src} alt={cur.caption} className="h-full w-full object-contain" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm font-semibold text-white">
                  {cur.caption}
                </div>
              </>
            )}

            {cur?.kind === "video" && (
              <>
                <video
                  ref={videoRef}
                  src={cur.src}
                  controls
                  playsInline
                  className="h-full w-full bg-black object-contain"
                  onEnded={() => {
                    if (playing) {
                      setIdx((i) => {
                        if (i + 1 < total) return i + 1;
                        setPlaying(false);
                        return i;
                      });
                    }
                  }}
                />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm font-semibold text-white">
                  {cur.caption}
                </div>
              </>
            )}
          </div>

          {/* 진행 표시 */}
          <div className="flex flex-wrap gap-1">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={"h-1.5 flex-1 rounded-full " + (i <= idx ? "bg-[#F37021]" : "bg-neutral-200")}
                aria-label={`슬라이드 ${i + 1}`}
              />
            ))}
          </div>

          {/* 컨트롤 */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              ⏮ 이전
            </button>
            <button
              type="button"
              onClick={() => {
                if (idx >= total - 1) setIdx(0);
                setPlaying((p) => !p);
              }}
              className="rounded-md bg-[#1E3A5F] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#16304d]"
            >
              {playing ? "⏸ 일시정지" : "▶ 자동재생"}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              다음 ⏭
            </button>
          </div>
          <p className="text-center text-xs text-neutral-400">
            {idx + 1} / {total} · 자동 구성 미리보기 (최종 MP4 내보내기는 다음 단계에서 추가됩니다)
          </p>
        </div>
      )}
    </div>
  );
}
