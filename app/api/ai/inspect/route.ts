import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recordAssets, guideEntries, guideAssets, structureTypes } from "@/lib/db/schema";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

async function streamToBase64(fileId: string): Promise<string | null> {
  try {
    const stream = await getDriveStream(fileId);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    const buf = Buffer.concat(chunks);
    if (buf.length > 5 * 1024 * 1024) return null;
    return buf.toString("base64");
  } catch {
    return null;
  }
}

async function streamToBase64Big(fileId: string): Promise<string | null> {
  try {
    const stream = await getDriveStream(fileId);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    const buf = Buffer.concat(chunks);
    if (buf.length > 15 * 1024 * 1024) return null;
    return buf.toString("base64");
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI 기능이 설정되지 않았습니다(GEMINI_API_KEY 없음)." }, { status: 503 });
    }

    const body = await req.json();
    const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds.slice(0, 5) : [];
    const phaseName: string = (body.phaseName || "").toString().slice(0, 100);
    const phaseCode: string = (body.phaseCode || "").toString().slice(0, 50);
    const structureTypeName: string = (body.structureTypeName || "").toString().slice(0, 100);
    const subTypeName: string = (body.subTypeName || "").toString().slice(0, 100);
    const subTypeId: string = (body.subTypeId || "").toString().slice(0, 100);
    const guideTextIn: string = (body.guideText || "").toString().slice(0, 3000);
    const userMemo: string = (body.userMemo || "").toString().slice(0, 1000);

    // 세부항목 가이드 (guide_entries)
    let subGuideText = "";
    if (subTypeId && phaseCode) {
      const rows = await db
        .select({ guideText: guideEntries.guideText })
        .from(guideEntries)
        .where(and(eq(guideEntries.subTypeId, subTypeId), eq(guideEntries.phaseCode, phaseCode)))
        .limit(1);
      subGuideText = rows[0]?.guideText || "";
    }

    // 검측 사진
    const inspectionImages: string[] = [];
    if (assetIds.length > 0) {
      const rows = await db
        .select({ id: recordAssets.id, storageFileId: recordAssets.storageFileId, assetType: recordAssets.assetType })
        .from(recordAssets)
        .where(and(inArray(recordAssets.id, assetIds), eq(recordAssets.assetType, "photo")));
      for (const r of rows) {
        if (!r.storageFileId) continue;
        const b64 = await streamToBase64(r.storageFileId);
        if (b64) inspectionImages.push(b64);
        if (inspectionImages.length >= 5) break;
      }
    }

    // 참고사진 (guide_assets: subTypeId + phaseCode, reference) 최대 2장
    const referenceImages: string[] = [];
    if (subTypeId && phaseCode) {
      const refRows = await db
        .select({ storageFileId: guideAssets.storageFileId })
        .from(guideAssets)
        .where(
          and(
            eq(guideAssets.subTypeId, subTypeId),
            eq(guideAssets.phaseCode, phaseCode),
            eq(guideAssets.assetKind, "reference")
          )
        );
      for (const r of refRows) {
        if (!r.storageFileId) continue;
        const b64 = await streamToBase64(r.storageFileId);
        if (b64) referenceImages.push(b64);
        if (referenceImages.length >= 2) break;
      }
    }

    // 대분류 시방서 (subTypeId -> 부모 structureType -> spec PDF) 최대 2개
    const specPdfs: { mimeType: string; data: string }[] = [];
    if (subTypeId) {
      const subRow = await db
        .select({ parentId: structureTypes.parentId })
        .from(structureTypes)
        .where(eq(structureTypes.id, subTypeId))
        .limit(1);
      const parentId = subRow[0]?.parentId || null;
      if (parentId) {
        const specRows = await db
          .select({ storageFileId: guideAssets.storageFileId, mimeType: guideAssets.mimeType })
          .from(guideAssets)
          .where(and(eq(guideAssets.structureTypeId, parentId), eq(guideAssets.assetKind, "spec")));
        for (const s of specRows) {
          if (!s.storageFileId) continue;
          const b64 = await streamToBase64Big(s.storageFileId);
          if (b64) specPdfs.push({ mimeType: s.mimeType || "application/pdf", data: b64 });
          if (specPdfs.length >= 2) break;
        }
      }
    }

    const hasGuide = !!(subGuideText || guideTextIn);
    const sys = [
      "당신은 한국 농어촌공사(KRC) 농업기반시설 건설공사의 '검측 기록'을 작성하는 전문가입니다.",
      "현장 검측 사진(스타프·줄자 등 측정 수치, 도면, 시공 상태)과 시방서를 분석하여, 검측 기록란에 들어갈 검측 내용을 한국어로 상세하고 사실적으로 작성합니다.",
      "",
      "[작성 형식]",
      "- 순수한 서술형 문장으로만 작성하세요. JSON·코드펜스·머리말·따옴표 묶음 없이 본문 텍스트만 출력합니다.",
      "- 4~8문장, 충분히 구체적으로 작성하세요. 너무 짧게 요약하지 마세요.",
      "",
      "[작성 원칙]",
      "- 사진에서 실제로 확인되는 것을 기술하세요(측정값, 부재, 배근/타설/다짐 상태 등). 보이지 않는 것을 지어내지 마세요.",
      "- 줄자·스타프 등 눈금/수치가 보이면 그 값을 읽어 기록에 포함하세요(예: '바닥 폭 1.00m 측정').",
      "- 공공 검측 문서 어투(간결한 서술식). 과장·홍보성 표현 금지. 합격/불합격 단정은 피하고 확인된 사실 위주.",
      referenceImages.length > 0
        ? "- 제공된 참고사진은 이 단계의 모범 촬영·검측 예시입니다. 비교 기준으로 삼되, 기록은 실제 검측사진 기준으로 작성하세요."
        : "",
      hasGuide ? "- 아래 '검측 가이드'의 확인 항목을 우선 반영하세요." : "",
      "",
      "[시방서 활용 - 매우 중요]",
      "- 첨부된 시방서(PDF)에서 이 공종·단계에 해당하는 시방 기준(허용오차, 기준 치수, 다짐도, 배근 간격, 재료 기준 등)을 찾아, 검측 내용에 반드시 구체적으로 인용하세요.",
      "- 예: '설계 바닥폭 1.00m에 대해 시방 허용오차 ±30mm 이내로 확인됨', 'KCS 기준 다짐도 90% 이상 요구'.",
      "- 사진의 측정값을 시방 기준과 비교하여 적합 여부를 사실 위주로 언급하세요.",
      "- 단, 시방서에 없는 수치는 지어내지 말고, 관련 기준이 없으면 일반 표준시방 지식 범위에서만 신중히 언급하세요.",
    ].filter(Boolean).join("\n");

    const guideBlock = [
      subGuideText ? `[세부항목(${subTypeName}) 가이드]\n${subGuideText}` : "",
      guideTextIn ? `[공통 가이드]\n${guideTextIn}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const userText =
      `구조물 종류: ${structureTypeName || "미상"}\n` +
      (subTypeName ? `세부 항목(공종): ${subTypeName}\n` : "") +
      `검측 단계: ${phaseName || "미상"}${phaseCode ? ` (${phaseCode})` : ""}\n` +
      (guideBlock ? `\n${guideBlock}\n` : "") +
      (userMemo ? `\n[작업자 메모]\n${userMemo}\n` : "") +
      (specPdfs.length > 0 ? `\n첨부된 시방서 ${specPdfs.length}건을 검측 기준 근거로 참고하세요.\n` : "") +
      (referenceImages.length > 0 ? `\n※ 앞쪽 ${referenceImages.length}장은 참고사진(모범 예시), 이후가 검측사진입니다.\n` : "") +
      `\n위 정보${inspectionImages.length > 0 ? "와 첨부 사진들" : ""}을 바탕으로, 시방 기준을 인용한 상세한 검측 기록을 서술형 문장으로 작성하세요.`;

    console.log("[ai:inspect] 진단", JSON.stringify({
      subTypeId,
      phaseCode,
      assetIdsIn: assetIds.length,
      inspectionImages: inspectionImages.length,
      referenceImages: referenceImages.length,
      specPdfs: specPdfs.length,
      subGuideLen: subGuideText.length,
      guideInLen: guideTextIn.length,
      model: GEMINI_MODEL,
    }));

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: sys,
    });

    // parts: 참고사진 -> 검측사진 -> 텍스트
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
    specPdfs.forEach((s) => parts.push({ inlineData: { mimeType: s.mimeType, data: s.data } }));
    referenceImages.forEach((data) => parts.push({ inlineData: { mimeType: "image/jpeg", data } }));
    inspectionImages.forEach((data) => parts.push({ inlineData: { mimeType: "image/jpeg", data } }));
    parts.push({ text: userText });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    });

    let out = (result.response.text() || "").trim();

    // 혹시 모델이 JSON/코드펜스로 감싸면 본문만 추출
    out = out.replace(/```json/gi, "").replace(/```/g, "").trim();
    if (out.startsWith("{") && out.includes('"text"')) {
      try {
        const j = JSON.parse(out);
        if (j && typeof j.text === "string") out = j.text;
      } catch {
        const m = out.match(/"text"\s*:\s*"([\s\S]*?)"\s*[,}]/);
        if (m) out = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }
    }
    out = out.trim();

    return NextResponse.json({
      ok: true,
      result: { text: out, measurements: [], notes: [] },
      imageCount: inspectionImages.length,
      refCount: referenceImages.length,
      specCount: specPdfs.length,
      _debug: { photos: inspectionImages.length, refs: referenceImages.length, specs: specPdfs.length },
    });
  } catch (e) {
    console.error("[ai:inspect]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "AI 분석 오류: " + msg }, { status: 500 });
  }
}
