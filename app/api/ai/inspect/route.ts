import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recordAssets } from "@/lib/db/schema";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

type Inspection = {
  labels: string[];
  checkpoints: { title: string; detail: string }[];
  summary: string;
};

async function streamToBase64(fileId: string): Promise<{ data: string; mime: string } | null> {
  try {
    const stream = await getDriveStream(fileId);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    const buf = Buffer.concat(chunks);
    // 너무 크면 스킵 (5MB 제한)
    if (buf.length > 5 * 1024 * 1024) return null;
    return { data: buf.toString("base64"), mime: "image/jpeg" };
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
    const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds.slice(0, 4) : [];
    const phaseName: string = (body.phaseName || "").toString().slice(0, 100);
    const structureTypeName: string = (body.structureTypeName || "").toString().slice(0, 100);
    const text: string = (body.text || "").toString().slice(0, 2000);

    // 사진 로드 (업로드된 record_assets 중 photo 만)
    const images: { data: string; mime: string }[] = [];
    if (assetIds.length > 0) {
      const rows = await db
        .select({ id: recordAssets.id, storageFileId: recordAssets.storageFileId, assetType: recordAssets.assetType })
        .from(recordAssets)
        .where(and(inArray(recordAssets.id, assetIds), eq(recordAssets.assetType, "photo")));
      for (const r of rows) {
        if (!r.storageFileId) continue;
        const img = await streamToBase64(r.storageFileId);
        if (img) images.push(img);
        if (images.length >= 4) break;
      }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const sys = [
      "당신은 한국 농업기반시설(농어촌공사) 건설공사 검측을 돕는 보조 도구입니다.",
      "현장 검측 사진과 작업자가 입력한 내용을 보고, 토목/건축 표준시방서 관점에서 확인할 체크포인트를 제시합니다.",
      "당신의 출력은 '참고용 보조'이며 최종 합격 판정이 아닙니다. 단정적 합격/불합격 표현은 피하고 '확인 필요' 형태로 제시하세요.",
      "반드시 아래 JSON 형식만 출력하세요(설명/마크다운/코드펜스 없이 순수 JSON):",
      '{"labels": ["사진에서 식별된 항목/상태 라벨 최대 6개"], "checkpoints": [{"title":"확인 항목","detail":"왜·무엇을 확인하는지 1~2문장"}], "summary":"전체 한줄 요약"}',
      "checkpoints 는 해당 공종/단계에 맞는 실무 점검사항으로 3~6개. 한국어로.",
    ].join("\n");

    const content: Anthropic.ContentBlockParam[] = [];
    images.forEach((img) => {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data },
      });
    });
    content.push({
      type: "text",
      text:
        `구조물 종류: ${structureTypeName || "미상"}\n` +
        `검측 단계: ${phaseName || "미상"}\n` +
        `작업자 입력 내용: ${text || "(없음)"}\n\n` +
        (images.length > 0 ? "위 사진들과 " : "") +
        "위 정보를 바탕으로 검측 체크포인트를 JSON으로 제시하세요.",
    });

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: sys,
      messages: [{ role: "user", content }],
    });

    const textOut = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let parsed: Inspection;
    try {
      const clean = textOut.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({
        ok: true,
        result: { labels: [], checkpoints: [], summary: textOut.slice(0, 300) },
        note: "형식 파싱 일부 실패 — 요약만 표시",
      });
    }

    return NextResponse.json({ ok: true, result: parsed, imageCount: images.length });
  } catch (e) {
    console.error("[ai:inspect]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "AI 분석 오류: " + msg }, { status: 500 });
  }
}
