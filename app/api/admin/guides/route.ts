import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { structureTypes, phaseTemplates } from "@/lib/db/schema";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

// GET: 구조물 트리(부모+자식) + 특정 구조물의 단계/가이드
// ?structureTypeId=xxx  -> 그 구조물의 단계 목록 반환
// 없으면 -> 구조물 트리(부모/자식) 반환
export async function GET(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const structureTypeId = searchParams.get("structureTypeId");

  if (structureTypeId) {
    const phases = await db
      .select({
        id: phaseTemplates.id,
        code: phaseTemplates.code,
        name: phaseTemplates.name,
        guideText: phaseTemplates.guideText,
        sortOrder: phaseTemplates.sortOrder,
      })
      .from(phaseTemplates)
      .where(and(eq(phaseTemplates.structureTypeId, structureTypeId), eq(phaseTemplates.isActive, true)))
      .orderBy(asc(phaseTemplates.sortOrder));
    return NextResponse.json({ ok: true, phases });
  }

  // 전체 구조물 트리
  const all = await db
    .select({
      id: structureTypes.id,
      name: structureTypes.name,
      code: structureTypes.code,
      parentId: structureTypes.parentId,
      sortOrder: structureTypes.sortOrder,
    })
    .from(structureTypes)
    .where(eq(structureTypes.isActive, true))
    .orderBy(asc(structureTypes.sortOrder));

  const parents = all.filter((s) => !s.parentId);
  const tree = parents.map((p) => ({
    ...p,
    children: all.filter((c) => c.parentId === p.id),
  }));
  // 자식 없는(부모가 null이 아닌데 부모가 목록에 없는) 항목도 최상위로
  const orphanChildren = all.filter((s) => s.parentId && !parents.some((p) => p.id === s.parentId));
  return NextResponse.json({ ok: true, tree, orphanChildren });
}

// PATCH: 단계 가이드 저장 [{ phaseTemplateId, guideText }]
export async function PATCH(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });

  try {
    const body = await req.json();
    const items: { phaseTemplateId: string; guideText: string }[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return NextResponse.json({ error: "저장할 항목이 없습니다." }, { status: 400 });

    for (const it of items) {
      if (!it.phaseTemplateId) continue;
      await db
        .update(phaseTemplates)
        .set({ guideText: (it.guideText ?? "").slice(0, 5000) || null, updatedAt: new Date() })
        .where(eq(phaseTemplates.id, it.phaseTemplateId));
    }
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "가이드 저장 오류: " + msg }, { status: 500 });
  }
}
