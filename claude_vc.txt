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
  contractorCompany: string | null;
  hasLogo: boolean;
  siteId: string;
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
  const [bgmOn, setBgmOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmNodesRef = useRef<{ gain: GainNode; oscs: OscillatorNode[]; lfo: OscillatorNode } | null>(null);

  function stopBgm() {
    const ctx = audioCtxRef.current;
    const nodes = bgmNodesRef.current;
    if (ctx && nodes) {
      try {
        nodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        const stopAt = ctx.currentTime + 1.2;
        nodes.oscs.forEach((o) => o.stop(stopAt));
        nodes.lfo.stop(stopAt);
      } catch {
        // ignore
      }
    }
    bgmNodesRef.current = null;
  }

  function startBgm() {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioCtxRef.current || new Ctor();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();
      stopBgm();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.gain.setTargetAtTime(0.06, ctx.currentTime, 1.2);
      master.connect(ctx.destination);
      // 잔잔한 화음 (코드: A2, E3, A3, C#4 느낌) + 비브라토 LFO
      const freqs = [110, 164.81, 220, 277.18];
      const oscs: OscillatorNode[] = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.22;
        o.connect(g);
        g.connect(master);
        o.start();
        return o;
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();
      bgmNodesRef.current = { gain: master, oscs, lfo };
    } catch {
      // 오디오 미지원 환경 무시
    }
  }

  function toggleBgm() {
    if (bgmOn) {
      stopBgm();
      setBgmOn(false);
    } else {
      startBgm();
      setBgmOn(true);
    }
  }

  useEffect(() => {
    return () => stopBgm();
  }, []);

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
        <h1 className="text-xl font-bold text-[#0033A0]">KRC 건설공사실록 · 영상 미리보기</h1>
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
                (d === date ? "bg-[#0033A0] text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
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
              <div key={`title-${idx}-${date}`} className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#001A52] px-6 text-center text-white">
                <div
                  className="krc-grid2 krc-zoom pointer-events-none absolute inset-0 opacity-[0.18]"
                  style={{
                    backgroundImage:
                      "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0033A0]/85 to-[#001233]/92" />
                <span className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-[#FE5000]" />
                <span className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-[#FE5000]" />
                <span className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-[#FE5000]" />
                <span className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-[#FE5000]" />
                <div className="krc-sweep2 pointer-events-none absolute inset-0" />
                <div className="krc-rays pointer-events-none absolute left-1/2 top-1/2 z-0 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-black/30 px-4 py-1.5 text-[10px] font-semibold tracking-widest text-white/80">
                  <span>한국농어촌공사 · CONSTRUCTION INSPECTION RECORD</span>
                  <span>검측일자 {date}</span>
                </div>
                <div className="krc-stroke krc-pop relative z-10 text-4xl font-extrabold tracking-tight" style={{ animationDelay: "0.05s" }}>KRC 건설공사실록</div>
                <div className="krc-grow2 relative z-10 mt-2 h-1 rounded-full bg-[#FE5000]" />
                <div className="krc-rise2 relative z-10 mt-3 text-2xl font-bold" style={{ animationDelay: "0.55s" }}>{meta.structureName}</div>
                <div className="krc-rise2 relative z-10 mt-1 text-sm text-white/90" style={{ animationDelay: "0.7s" }}>
                  {meta.projectName}{meta.districtName ? ` · ${meta.districtName}` : ""}
                </div>
                <div className="krc-rise2 relative z-10 mt-0.5 text-xs text-white/70" style={{ animationDelay: "0.82s" }}>{meta.address}</div>
                {(meta.hasLogo || meta.contractorCompany) && (
                  <div className="krc-rise2 relative z-10 mt-3 flex items-center justify-center gap-3" style={{ animationDelay: "0.95s" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/krc-logo-white.png" alt="한국농어촌공사" className="h-6 w-auto opacity-95" />
                    {meta.hasLogo ? (
                      <>
                        <span className="text-white/40">|</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/sites/${meta.siteId}/logo/raw`}
                          alt="시공사 로고"
                          className="h-8 w-auto rounded bg-white/90 px-1 py-0.5"
                        />
                      </>
                    ) : meta.contractorCompany ? (
                      <span className="text-xs font-semibold text-white/90">시공사 : {meta.contractorCompany}</span>
                    ) : null}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 grid grid-cols-3 divide-x divide-white/20 border-t border-white/20 bg-black/30 text-[11px]">
                  <div className="px-2 py-1.5">
                    <div className="text-white/50">공종</div>
                    <div className="truncate font-semibold">{meta.workType || meta.typeName || "-"}</div>
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-white/50">시행자</div>
                    <div className="truncate font-semibold">{meta.executor || "-"}</div>
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-white/50">{meta.contractorCompany ? "시공사" : "구조물"}</div>
                    <div className="truncate font-semibold">{meta.contractorCompany || meta.typeName || "-"}</div>
                  </div>
                </div>
              </div>
            )}

            {cur?.kind === "section" && (
              <div key={`section-${idx}`} className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#002A80] px-8 text-center text-white">
                <div
                  className="krc-grid2 krc-zoom pointer-events-none absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />
                <div className="krc-sweep2 pointer-events-none absolute inset-0" />
                <span className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-[#FE5000]" />
                <span className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-[#FE5000]" />
                <div className="krc-grow2 relative z-10 mb-3 h-1 rounded-full bg-[#FE5000]" />
                <div className="krc-pop krc-stroke relative z-10 text-4xl font-extrabold">{cur.label}</div>
                {cur.text && <div className="krc-rise2 relative z-10 mt-3 max-w-xl text-sm leading-relaxed text-white/90" style={{ animationDelay: "0.3s" }}>{cur.text}</div>}
              </div>
            )}

            {cur?.kind === "image" && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.src} alt={cur.caption} className="h-full w-full object-contain" />
                <div className="pointer-events-none absolute left-3 top-3 rounded bg-[#0033A0]/85 px-2 py-1 text-[11px] font-bold text-white">
                  KRC 건설공사실록 · {date}
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 text-sm font-semibold text-white">
                  <span className="inline-block h-4 w-1 rounded-full bg-[#FE5000]" />
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
                <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-[#0033A0]/85 px-2 py-1 text-[11px] font-bold text-white">
                  KRC 건설공사실록 · {date}
                </div>
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 text-sm font-semibold text-white">
                  <span className="inline-block h-4 w-1 rounded-full bg-[#FE5000]" />
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
                className={"h-1.5 flex-1 rounded-full " + (i <= idx ? "bg-[#FE5000]" : "bg-neutral-200")}
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
                const next = !playing;
                setPlaying(next);
                if (next && !bgmOn) {
                  startBgm();
                  setBgmOn(true);
                }
              }}
              className="rounded-md bg-[#0033A0] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#002A80]"
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
            <button
              type="button"
              onClick={toggleBgm}
              className={
                "rounded-md border px-3 py-1.5 text-sm " +
                (bgmOn ? "border-[#0033A0] bg-[#EAF0FB] text-[#0033A0]" : "border-neutral-300 hover:bg-neutral-50")
              }
              title="배경음악"
            >
              {bgmOn ? "🔊 BGM" : "🔇 BGM"}
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
