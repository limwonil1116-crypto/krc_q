import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checklistPresets } from "@/lib/db/schema";

export const runtime = "nodejs";

// GET ?subTypeId=xxx  -> 해당 공종의 프리셋 항목
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const subTypeId = (searchParams.get("subTypeId") || "").trim();
  if (!subTypeId) return NextResponse.json({ ok: true, items: [] });

  const rows = await db
    .select({ itemNo: checklistPresets.itemNo, checkItem: checklistPresets.checkItem, standard: checklistPresets.standard })
    .from(checklistPresets)
    .where(eq(checklistPresets.subTypeId, subTypeId))
    .orderBy(asc(checklistPresets.sortOrder));

  return NextResponse.json({ ok: true, items: rows });
}
