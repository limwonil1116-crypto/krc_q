import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { inspectionRequests, checklistItems } from "@/lib/db/schema";

export const runtime = "nodejs";

// 감독원 검토 저장: 체크리스트 2차 체크 + 검측결과/지시사항
// body: { id, inspectionResult, instruction, itemReviews: [{id, supervisorResult, supervisorNote}], approve?, requestRevision? }
export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "supervisor" && role !== "admin")) {
      return NextResponse.json({ error: "공사감독원 권한이 필요합니다." }, { status: 403 });
    }
    const userId = session.user.id;
    const b = await req.json();
    const id = (b.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "요청서 ID가 필요합니다." }, { status: 400 });

    const rows = await db.select().from(inspectionRequests).where(eq(inspectionRequests.id, id)).limit(1);
    const ir = rows[0];
    if (!ir) return NextResponse.json({ error: "요청서를 찾을 수 없습니다." }, { status: 404 });

    // 배정된 감독원 본인만 (admin 예외)
    if (role !== "admin" && ir.supervisorId !== userId) {
      return NextResponse.json({ error: "배정된 검측 요청이 아닙니다." }, { status: 403 });
    }

    // 체크리스트 항목 2차 체크 업데이트
    if (Array.isArray(b.itemReviews)) {
      for (const it of b.itemReviews) {
        const itemId = (it.id ?? "").trim();
        if (!itemId) continue;
        await db
          .update(checklistItems)
          .set({
            supervisorResult: (it.supervisorResult ?? "").trim() || null,
            supervisorNote: (it.supervisorNote ?? "").trim() || null,
          })
          .where(eq(checklistItems.id, itemId));
      }
    }

    // 상태 결정
    const approve = b.approve === true;
    const requestRevision = b.requestRevision === true;
    let status = ir.status as string;
    const extra: Record<string, unknown> = {};
    if (approve) {
      status = "approved";
      extra.supervisorSignature = (b.supervisorSignature ?? "").trim() || ir.supervisorSignature || null;
      extra.supervisorSignedAt = new Date();
    } else if (requestRevision) {
      status = "revision_requested";
    } else {
      // 단순 검토 저장 -> under_review
      status = ir.status === "submitted" ? "under_review" : ir.status;
    }

    await db
      .update(inspectionRequests)
      .set({
        inspectionResult: (b.inspectionResult ?? "").trim() || null,
        instruction: (b.instruction ?? "").trim() || null,
        status: status as typeof ir.status,
        ...extra,
        updatedAt: new Date(),
      })
      .where(eq(inspectionRequests.id, id));

    return NextResponse.json({ ok: true, id, status });
  } catch (e) {
    console.error("[inspections:review]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "검토 저장 오류: " + msg }, { status: 500 });
  }
}
