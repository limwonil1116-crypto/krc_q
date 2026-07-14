import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, constructionRecords, siteParticipants } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

export const runtime = "nodejs";

async function ownsSite(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return false;
  const _sess = await auth();
  const _role = _sess?.user?.role;
  if (_role === "client" || _role === "admin") return true;
  const orgId = await getMyOrgId(userId);
  if (site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId))) {
    return true;
  }
  // 참여자로 초대된 경우 허용
  const _part = await db
    .select({ id: siteParticipants.id })
    .from(siteParticipants)
    .where(and(eq(siteParticipants.siteId, siteId), eq(siteParticipants.userId, userId)))
    .limit(1);
  return !!_part[0];
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client" && role !== "admin")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;

    const b = await req.json();
    const siteStructureId = (b.siteStructureId ?? "").trim();
    const subTypeId = (b.subTypeId ?? "").trim();
    const inspectionDate = (b.inspectionDate ?? "").trim();
    const action = b.action === "cancel" ? "cancel" : "submit";
    if (!siteStructureId || !subTypeId || !inspectionDate) {
      return NextResponse.json({ error: "구조물/세부항목/검측일자 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    if (!(await ownsSite(userId, ss.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const newStatus = action === "cancel" ? ("draft" as const) : ("submitted" as const);
    await db
      .update(constructionRecords)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(
        and(
          eq(constructionRecords.siteStructureId, siteStructureId),
          eq(constructionRecords.subTypeId, subTypeId),
          eq(constructionRecords.inspectionDate, inspectionDate)
        )
      );

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e) {
    console.error("[records:submit]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "제출 처리 오류: " + msg }, { status: 500 });
  }
}
