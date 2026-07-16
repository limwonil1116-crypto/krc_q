"use client";

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { InspectionPdfDoc, type PdfData, type PdfAsset } from "@/components/inspection/inspection-pdf-doc";

// 영상에서 주요 프레임 캡처 (시작/중간/끝 3장)
async function captureVideoFrames(url: string): Promise<string[]> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    const frames: string[] = [];
    v.onloadeddata = async () => {
      const dur = v.duration || 0;
      // 재생 길이를 9등분해 8장을 균등 간격으로 캡처 (같은 장면 반복 방지)
      const FRAME_COUNT = 8;
      const points =
        dur > 0
          ? Array.from({ length: FRAME_COUNT }, (_, i) => (dur * (i + 1)) / (FRAME_COUNT + 1))
          : [0];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      for (const t of points) {
        await new Promise<void>((res) => {
          const onSeek = () => {
            canvas.width = v.videoWidth || 640;
            canvas.height = v.videoHeight || 360;
            ctx?.drawImage(v, 0, 0, canvas.width, canvas.height);
            try {
              frames.push(canvas.toDataURL("image/jpeg", 0.8));
            } catch {}
            v.removeEventListener("seeked", onSeek);
            res();
          };
          v.addEventListener("seeked", onSeek);
          v.currentTime = Math.min(t, (v.duration || 1) - 0.05);
        });
      }
      resolve(frames);
    };
    v.onerror = () => resolve([]);
  });
}

export function InspectionPdfButton({
  requestId,
  className,
  label = "📄 PDF 다운로드",
}: {
  requestId: string;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function generate() {
    if (!requestId) {
      alert("먼저 저장한 뒤 PDF를 받을 수 있습니다.");
      return;
    }
    setBusy(true);
    setProgress("데이터 불러오는 중...");
    try {
      // 1) 데이터 로드
      const res = await fetch(`/api/inspections?id=${requestId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || "데이터를 불러오지 못했습니다.");
        return;
      }

      const assets: PdfAsset[] = data.assets || [];

      // 2) 영상 프레임 캡처
      let videoFrames: string[] = [];
      const videoAsset = assets.find((a) => a.assetType === "video");
      if (videoAsset) {
        setProgress("영상 장면 캡처 중...");
        videoFrames = await captureVideoFrames(videoAsset.url);
      }

      const pdfData: PdfData = {
        request: {
          inspectionDate: data.request.inspectionDate,
          requestNo: data.request.requestNo,
          locationWork: data.request.locationWork,
          inspectionPart: data.request.inspectionPart,
          inspectionMatter: data.request.inspectionMatter,
          isRecheck: data.request.isRecheck,
          contractorAgentName: data.request.contractorAgentName,
          contractorCheckerName: data.request.contractorCheckerName,
          contractorSignature: data.request.contractorSignature ?? null,
          inspectionResult: data.request.inspectionResult,
          instruction: data.request.instruction,
          supervisorSignature: data.request.supervisorSignature,
          status: data.request.status,
        },
        meta: {
          projectName: data.meta?.projectName || "",
          structureName: data.meta?.structureName || "",
          contractorCompany: data.meta?.contractorCompany || null,
          supervisorName: data.meta?.supervisorName || "",
        },
        checklists: (data.checklists || []).map((cl: {
          id: string; facilityName: string | null; locationPart: string | null;
          workName: string | null; quantity: string | null; stage: string | null;
          items: Array<Record<string, unknown>>;
        }) => ({
          id: cl.id,
          facilityName: cl.facilityName,
          locationPart: cl.locationPart,
          workName: cl.workName,
          quantity: cl.quantity,
          stage: cl.stage,
          items: (cl.items || []).map((it) => ({
            id: it.id,
            itemNo: it.itemNo,
            checkItem: it.checkItem ?? it.check_item,
            standard: it.standard,
            contractorResult: it.contractorResult ?? it.contractor_result,
            contractorNote: it.contractorNote ?? it.contractor_note,
            supervisorResult: it.supervisorResult ?? it.supervisor_result,
            supervisorNote: it.supervisorNote ?? it.supervisor_note,
          })),
        })),
        assets,
        videoFrames,
      };

      // 3) 문서 렌더 (오프스크린)
      setProgress("문서 생성 중...");
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      const pageEls: (HTMLDivElement | null)[] = [];
      const setRef = (el: HTMLDivElement | null, idx: number) => {
        pageEls[idx] = el;
      };
      await new Promise<void>((resolve) => {
        root.render(<InspectionPdfDoc data={pdfData} pageRefs={setRef} />);
        setTimeout(resolve, 800); // 렌더 + 이미지 로드 대기
      });

      // 4) 각 페이지 캡처 -> jsPDF
      setProgress("PDF 만드는 중...");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = 210;
      const ph = 297;
      const pages = pageEls.filter((e): e is HTMLDivElement => !!e);
      let first = true;
      for (const el of pages) {
        const png = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(png, "PNG", 0, 0, pw, ph);
      }

      root.unmount();
      document.body.removeChild(host);

      const fname = `검측_${pdfData.meta.structureName || "결과서"}_${pdfData.request.inspectionDate || ""}.pdf`;
      pdf.save(fname);
    } catch (e) {
      console.error(e);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={busy}
      className={className || "rounded-md bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"}
    >
      {busy ? progress || "생성 중..." : label}
    </button>
  );
}
