import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { guideEntries, phaseTemplates, structureTypes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type Item = { check_item: string; standard: string };

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI 설정이 필요합니다." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const workName: string = String(body.workName || "").trim(); // 공종/검측사항 (예: 구조물터파기)
    const subTypeName: string = String(body.subTypeName || "").trim();
    const subTypeId: string = String(body.subTypeId || "").trim();
    const phaseCode: string = String(body.phaseCode || "").trim();
    const stage: string = String(body.stage || "").trim(); // 타설전/중/후 등 (선택)
    const extraContext: string = String(body.context || "").trim();

    if (!workName && !subTypeName) {
      return NextResponse.json({ error: "공종 정보가 필요합니다." }, { status: 400 });
    }

    // 시방서(가이드) 조회
    let guideText = "";
    if (subTypeId) {
      const rows = await db
        .select({ guideText: guideEntries.guideText, phaseCode: guideEntries.phaseCode })
        .from(guideEntries)
        .where(
          phaseCode
            ? and(eq(guideEntries.subTypeId, subTypeId), eq(guideEntries.phaseCode, phaseCode))
            : eq(guideEntries.subTypeId, subTypeId)
        );
      guideText = rows.map((r) => r.guideText || "").filter(Boolean).join("\n\n");
    }

    const sys = [
      "당신은 한국농어촌공사(KRC)의 건설공사 검측 전문가입니다.",
      "주어진 공종에 대해 '별지 제5호 검측 체크리스트' 형식의 검측 항목을 생성합니다.",
      "각 항목은 현장에서 시공자와 감독원이 합격/불합격을 체크할 수 있는 명확한 확인 질문이어야 합니다.",
      "각 항목마다 '검사기준'(시방서/설계도면 근거)을 함께 제시합니다.",
      "실제 KRC 검측 관행(터파기, 철근조립, 거푸집, 콘크리트 타설, 되메우기, 방수 등)에 맞는 표준 항목을 작성합니다.",
      "가능하면 시방 기준(허용오차, KRCCS 등)을 검사기준에 반영합니다.",
      "출력은 반드시 아래 JSON 배열 형식만 출력합니다. 다른 설명/문장/코드펜스 없이 순수 JSON만.",
      '[{"check_item":"검측 항목 질문","standard":"검사기준(시방/도면 근거)"}, ...]',
      "항목 수는 공종에 맞게 5~15개 내외로 합니다.",
    ].join("\n");

    const userText = [
      `공종/검측사항: ${workName || subTypeName}`,
      subTypeName ? `세부공종: ${subTypeName}` : "",
      stage ? `단계: ${stage}` : "",
      guideText ? `\n[시방서/지침 내용]\n${guideText}` : "\n(시방서 자료 없음 - 표준 검측 관행 기준으로 작성)",
      extraContext ? `\n[참고]\n${extraContext}` : "",
      "\n위 공종에 대한 검측 체크리스트 항목을 JSON 배열로 생성하세요.",
    ].filter(Boolean).join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: sys });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
    });

    let out = (result.response.text() || "").trim();
    // 코드펜스 제거
    out = out.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    // JSON 배열 부분만 추출
    const s = out.indexOf("[");
    const e = out.lastIndexOf("]");
    if (s !== -1 && e !== -1) out = out.slice(s, e + 1);

    let items: Item[] = [];
    try {
      const parsed = JSON.parse(out);
      if (Array.isArray(parsed)) {
        items = parsed
          .map((x) => ({
            check_item: String(x.check_item || x.item || "").trim(),
            standard: String(x.standard || x.criteria || "").trim(),
          }))
          .filter((x) => x.check_item);
      }
    } catch {
      return NextResponse.json(
        { error: "AI 응답 파싱 실패", raw: out.slice(0, 500) },
        { status: 502 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "생성된 항목이 없습니다.", raw: out.slice(0, 500) }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      items,
      count: items.length,
      _debug: { hasGuide: guideText.length > 0, guideLen: guideText.length, model: GEMINI_MODEL },
    });
  } catch (e) {
    console.error("[ai:checklist] error", e);
    return NextResponse.json({ error: "체크리스트 생성 중 오류" }, { status: 500 });
  }
}
