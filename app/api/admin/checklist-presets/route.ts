import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checklistPresets, structureTypes } from "@/lib/db/schema";

export const runtime = "nodejs";

async function requireAdmin() {
  const s = await auth();
  if (!s?.user?.id || s.user.role !== "admin") return null;
  return s.user.id;
}

// GET: 저장된 프리셋을 공종별로 묶어 반환
export async function GET() {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const rows = await db
    .select({
      subTypeId: checklistPresets.subTypeId,
      itemNo: checklistPresets.itemNo,
      checkItem: checklistPresets.checkItem,
      standard: checklistPresets.standard,
      sortOrder: checklistPresets.sortOrder,
    })
    .from(checklistPresets)
    .orderBy(asc(checklistPresets.sortOrder));

  const subIds = Array.from(new Set(rows.map((r) => r.subTypeId)));
  const names = new Map<string, string>();
  const parents = new Map<string, string>();
  if (subIds.length > 0) {
    const subs = await db
      .select({ id: structureTypes.id, name: structureTypes.name, parentId: structureTypes.parentId })
      .from(structureTypes)
      .where(inArray(structureTypes.id, subIds));
    const allParents = await db
      .select({ id: structureTypes.id, name: structureTypes.name })
      .from(structureTypes);
    const pmap = new Map(allParents.map((p) => [p.id, p.name]));
    subs.forEach((s) => {
      names.set(s.id, s.name);
      parents.set(s.id, s.parentId ? pmap.get(s.parentId) || "" : "");
    });
  }

  const grouped = subIds.map((sid) => ({
    subTypeId: sid,
    subName: names.get(sid) || "(알 수 없음)",
    parentName: parents.get(sid) || "",
    items: rows
      .filter((r) => r.subTypeId === sid)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({ itemNo: r.itemNo, checkItem: r.checkItem, standard: r.standard })),
  }));
  grouped.sort((a, b) => (a.parentName + a.subName).localeCompare(b.parentName + b.subName, "ko"));

  return NextResponse.json({ ok: true, groups: grouped, totalItems: rows.length, totalSubTypes: subIds.length });
}

// DELETE: ?subTypeId=xxx  (해당 공종 프리셋 전체 삭제) / 없으면 전체 삭제
export async function DELETE(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const subTypeId = searchParams.get("subTypeId");
    if (subTypeId) {
      await db.delete(checklistPresets).where(eq(checklistPresets.subTypeId, subTypeId));
    } else {
      await db.delete(checklistPresets);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "삭제 오류: " + msg }, { status: 500 });
  }
}
