import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { structureTypes, guideEntries, guideAssets } from "@/lib/db/schema";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

async function streamToBase64(fileId: string, maxBytes: number): Promise<string | null> {
  try {
    const stream = await getDriveStream(fileId);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    const buf = Buffer.concat(chunks);
    if (buf.length > maxBytes) return null;
    return buf.toString("base64");
  } catch {
    return null;
  }
}

// POST: { subTypeId, phaseCode, phaseName } -> AI가 촬영가이드 생성 후 guide_entries 저장
export async function POST(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY 가 설정되지 않았습니다." }, { status: 503 });
    }
    const body = await req.json();
    const subTypeId = String(body.subTypeId || "");
    const phaseCode = String(body.phaseCode || "");
    const phaseName = String(body.phaseName || "").slice(0, 100);
    const currentText = String(body.currentText || "").slice(0, 3000);
    if (!subTypeId || !phaseCode) {
      return NextResponse.json({ error: "세부항목/단계 정보가 필요합니다." }, { status: 400 });
    }

    // 세부항목 + 대분류 이름
    const subRows = await db
      .select({ id: structureTypes.id, name: structureTypes.name, parentId: structureTypes.parentId })
      .from(structureTypes)
      .where(eq(structureTypes.id, subTypeId))
      .limit(1);
    const sub = subRows[0];
    if (!sub) return NextResponse.json({ error: "세부항목을 찾을 수 없습니다." }, { status: 404 });
    let parentName = "";
    if (sub.parentId) {
      const pr = await db
        .select({ name: structureTypes.name })
        .from(structureTypes)
        .where(eq(structureTypes.id, sub.parentId))
        .limit(1);
      parentName = pr[0]?.name || "";
    }

    // 이 단계 자료: 시방서(spec) + 참고사진(reference)
    const assets = await db
      .select({
        assetKind: guideAssets.assetKind,
        mimeType: guideAssets.mimeType,
        storageFileId: guideAssets.storageFileId,
      })
      .from(guideAssets)
      .where(and(eq(guideAssets.subTypeId, subTypeId), eq(guideAssets.phaseCode, phaseCode)));

    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

    // 시방서 PDF (최대 2개, 각 15MB)
    let specCount = 0;
    for (const a of assets) {
      if (a.assetKind !== "spec" || !a.storageFileId) continue;
      const b64 = await streamToBase64(a.storageFileId, 15 * 1024 * 1024);
      if (b64) {
        parts.push({ inlineData: { mimeType: a.mimeType || "application/pdf", data: b64 } });
        specCount++;
      }
      if (specCount >= 2) break;
    }
    // 참고사진 (최대 3장)
    let refCount = 0;
    for (const a of assets) {
      if (a.assetKind !== "reference" || !a.storageFileId) continue;
      const b64 = await streamToBase64(a.storageFileId, 5 * 1024 * 1024);
      if (b64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
        refCount++;
      }
      if (refCount >= 3) break;
    }

    const sys = [
      "당신은 한국 농어촌공사(KRC) 건설공사 검측의 '촬영·검측 가이드'를 작성하는 전문가입니다.",
      "주어진 시방서(PDF)와 참고사진, 구조물/공종/단계 정보를 종합하여, 현장 작업자가 이 단계에서 무엇을 어떻게 촬영·검측해야 하는지 명확한 가이드를 작성합니다.",
      "작성 지침:",
      "- 시방서가 제공되면 해당 공종·단계에 관련된 기준(치수, 허용오차, 확인항목)을 근거로 삼으세요.",
      "- 참고사진이 있으면 그 촬영 구도·표시 방식을 반영하세요.",
      "- 현장에서 바로 쓸 수 있게 구체적으로: ①확인 항목 ②촬영 방법(구도/대상) ③측정·기준값(시방서 근거).",
      "- 5~12줄 내외. 개조식(-, •) 위주. 군더더기 없이.",
      "- 시방서에 없는 수치를 지어내지 마세요. 불명확하면 '설계도서 확인' 으로 표기.",
      "출력은 가이드 본문 텍스트만. 제목·머리말·코드펜스 없이.",
    ].join("\n");

    const promptText =
      `대분류: ${parentName || "미상"}\n` +
      `세부항목(공종): ${sub.name}\n` +
      `검측 단계: ${phaseName || phaseCode} (${phaseCode})\n` +
      (currentText ? `\n[관리자가 작성 중인 초안 - 참고]\n${currentText}\n` : "") +
      (specCount > 0 ? `\n첨부된 시방서 ${specCount}건을 근거로 삼으세요.` : "\n(첨부 시방서 없음 - 일반 표준시방 지식 + 아래 정보로 작성)") +
      (refCount > 0 ? `\n첨부된 참고사진 ${refCount}장의 촬영 방식을 반영하세요.` : "") +
      `\n\n위 정보를 바탕으로 이 단계의 촬영·검측 가이드를 작성하세요.`;
    parts.push({ text: promptText });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: sys });
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: 1024 },
    });
    const guideText = (result.response.text() || "").trim().slice(0, 8000);

    if (!guideText) {
      return NextResponse.json({ error: "가이드 생성 결과가 비었습니다." }, { status: 500 });
    }

    // guide_entries upsert
    const existing = await db
      .select({ id: guideEntries.id })
      .from(guideEntries)
      .where(and(eq(guideEntries.subTypeId, subTypeId), eq(guideEntries.phaseCode, phaseCode)))
      .limit(1);
    if (existing[0]) {
      await db.update(guideEntries).set({ guideText, updatedAt: new Date() }).where(eq(guideEntries.id, existing[0].id));
    } else {
      await db.insert(guideEntries).values({ subTypeId, phaseCode, guideText });
    }

    return NextResponse.json({ ok: true, guideText, specCount, refCount });
  } catch (e) {
    console.error("[guides:generate]", e);
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "가이드 생성 오류: " + msg }, { status: 500 });
  }
}
