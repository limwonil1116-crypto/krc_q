import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recordAssets } from "@/lib/db/schema";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI 기능이 설정되지 않았습니다(API 키 없음)." }, { status: 503 });
    }

    const body = await req.json();
    const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds.slice(0, 5) : [];
    const phaseName: string = (body.phaseName || "").toString().slice(0, 100);
    const structureTypeName: string = (body.structureTypeName || "").toString().slice(0, 100);
    const subTypeName: string = (body.subTypeName || "").toString().slice(0, 100);
    const guideText: string = (body.guideText || "").toString().slice(0, 3000); // Phase 2: 구조물별 촬영/검측 가이드
    const userMemo: string = (body.userMemo || "").toString().slice(0, 1000); // 작업자가 남긴 메모(선택)

    // 사진 로드
    const images: string[] = [];
    if (assetIds.length > 0) {
      const rows = await db
        .select({ id: recordAssets.id, storageFileId: recordAssets.storageFileId, assetType: recordAssets.assetType })
        .from(recordAssets)
        .where(and(inArray(recordAssets.id, assetIds), eq(recordAssets.assetType, "photo")));
      for (const r of rows) {
        if (!r.storageFileId) continue;
        const b64 = await streamToBase64(r.storageFileId);
        if (b64) images.push(b64);
        if (images.length >= 5) break;
      }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const sys = [
      "당신은 한국 농어촌공사(KRC) 농업기반시설 건설공사의 '검측 기록'을 작성하는 보조 도구입니다.",
      "현장 검측 사진(스타프·줄자 등 측정 수치, 도면 표시, 시공 상태)을 분석하여, 검측 기록란에 들어갈 '검측 내용 문장'을 한국어로 간결하고 사실적으로 작성합니다.",
      "작성 원칙:",
      "- 사진에서 실제로 확인되는 것만 기술하세요(측정값, 부재, 상태). 보이지 않는 것을 추측하지 마세요.",
      "- 줄자·스타프 등 눈금/수치가 보이면 그 값을 읽어 기록에 포함하세요(예: '바닥 폭 0.00m 확인').",
      "- 공공 검측 문서 어투(간결한 개조식/서술식)로 작성. 과장·홍보성 표현 금지.",
      "- 합격/불합격 같은 최종 판정은 단정하지 말고, 확인된 사실 위주로 기술하세요.",
      guideText ? "아래 '검측 가이드'에 제시된 확인 항목을 우선적으로 반영하세요." : "",
      "반드시 아래 JSON 형식만 출력하세요(코드펜스/설명 없이 순수 JSON):",
      '{"text":"검측 기록란에 바로 넣을 검측 내용(2~5문장)","measurements":["사진에서 읽은 수치/치수 항목(없으면 빈 배열)"],"notes":["작성자가 추가 확인하면 좋을 참고사항 0~3개"]}',
    ].filter(Boolean).join("\n");

    const userText =
      `구조물 종류: ${structureTypeName || "미상"}\n` +
      (subTypeName ? `세부 구조물: ${subTypeName}\n` : "") +
      `검측 단계: ${phaseName || "미상"}\n` +
      (guideText ? `\n[검측 가이드]\n${guideText}\n` : "") +
      (userMemo ? `\n[작업자 메모]\n${userMemo}\n` : "") +
      `\n위 정보${images.length > 0 ? "와 첨부 사진들" : ""}을 바탕으로 검측 기록을 JSON으로 작성하세요.`;

    const content: Anthropic.ContentBlockParam[] = [];
    images.forEach((data) => {
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    });
    content.push({ type: "text", text: userText });

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: sys,
      messages: [{ role: "user", content }],
    });

    const out = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    try {
      const clean = out.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      return NextResponse.json({ ok: true, result: parsed, imageCount: images.length });
    } catch {
      // JSON 실패 시 통짜 텍스트라도 반환
      return NextResponse.json({
        ok: true,
        result: { text: out.slice(0, 800), measurements: [], notes: [] },
        imageCount: images.length,
      });
    }
  } catch (e) {
    console.error("[ai:inspect]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "AI 분석 오류: " + msg }, { status: 500 });
  }
}
