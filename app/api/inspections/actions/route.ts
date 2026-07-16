import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  constructionSites,
  inspectionRequests,
  siteParticipants,
  checklists,
  checklistItems,
} from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

async function canManage(userId: string, role: string | undefined, siteId: string) {
  if (role === "client" || role === "admin") return true;
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return false;
  const orgId = await getMyOrgId(userId);
  if (site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId))) {
    return true;
  }
  const part = await db
    .select({ id: siteParticipants.id })
    .from(siteParticipants)
    .where(and(eq(siteParticipants.siteId, siteId), eq(siteParticipants.userId, userId)))
    .limit(1);
  return !!part[0];
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const userId = session.user.id;
    const b = await req.json();
    const id = (b.id ?? "").trim();
    const action = b.action === "delete" ? "delete" : "withdraw";
    if (!id) {
      return NextResponse.json({ error: "요청서 정보가 필요합니다." }, { status: 400 });
    }

    const rows = await db.select().from(inspectionRequests).where(eq(inspectionRequests.id, id)).limit(1);
    const ir = rows[0];
    if (!ir) {
      return NextResponse.json({ error: "요청서를 찾을 수 없습니다." }, { status: 404 });
    }
    if (!(await canManage(userId, session.user.role, ir.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (ir.status === "approved") {
      return NextResponse.json(
        { error: "승인 완료된 요청서는 회수·삭제할 수 없습니다. 감독원에게 문의하세요." },
        { status: 400 }
      );
    }

    if (action === "delete") {
      // 체크리스트 항목 -> 체크리스트 -> 요청서 순으로 삭제
      const cls = await db.select({ id: checklists.id }).from(checklists).where(eq(checklists.inspectionRequestId, id));
      for (const cl of cls) {
        await db.delete(checklistItems).where(eq(checklistItems.checklistId, cl.id));
      }
      await db.delete(checklists).where(eq(checklists.inspectionRequestId, id));
      await db.delete(inspectionRequests).where(eq(inspectionRequests.id, id));
      return NextResponse.json({ ok: true, deleted: true });
    }

    // 회수: 제출 상태를 작성중으로 되돌리고 감독 서명/결과 초기화
    await db
      .update(inspectionRequests)
      .set({
        status: "draft" as const,
        supervisorSignature: null,
        supervisorSignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(inspectionRequests.id, id));
    return NextResponse.json({ ok: true, status: "draft" });
  } catch (e) {
    console.error("[inspections:actions]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "처리 오류: " + msg }, { status: 500 });
  }
}
