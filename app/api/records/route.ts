import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, constructionRecords, recordAssets, siteParticipants } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

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
    const phaseTemplateId = (b.phaseTemplateId ?? "").trim();
    const inspectionDate = (b.inspectionDate ?? "").trim() || todayStr();
    if (!siteStructureId || !subTypeId || !phaseTemplateId) {
      return NextResponse.json({ error: "구조물/세부항목/단계 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    if (!(await ownsSite(userId, ss.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const notApplicable = !!b.notApplicable;
    const values = {
      subTypeId,
      inspectionDate,
      inspectionContent: notApplicable ? null : (b.inspectionContent ?? "").trim() || null,
      inspectionPartFromMain: notApplicable ? null : (typeof b.inspectionPartFromMain === "number" ? b.inspectionPartFromMain : null),
      inspectionPartFromSub: notApplicable ? null : (typeof b.inspectionPartFromSub === "number" ? b.inspectionPartFromSub : null),
      inspectionPartToMain: notApplicable ? null : (typeof b.inspectionPartToMain === "number" ? b.inspectionPartToMain : null),
      inspectionPartToSub: notApplicable ? null : (typeof b.inspectionPartToSub === "number" ? b.inspectionPartToSub : null),
      title: (b.title ?? "").trim() || null,
      textDescription: notApplicable ? null : (b.textDescription ?? "").trim() || null,
      voiceMemoText: notApplicable ? null : (b.voiceMemoText ?? "").trim() || null,
      notApplicable,
      notApplicableReason: notApplicable ? (b.notApplicableReason ?? "").trim() || null : null,
      status: notApplicable ? ("ready" as const) : ("draft" as const),
      latitude: typeof b.latitude === "number" ? b.latitude : null,
      longitude: typeof b.longitude === "number" ? b.longitude : null,
      locationAddress: (b.locationAddress ?? "").trim() || null,
      recordedAt: new Date(),
    };

    const existing = await db
      .select({ id: constructionRecords.id, status: constructionRecords.status })
      .from(constructionRecords)
      .where(
        and(
          eq(constructionRecords.siteStructureId, siteStructureId),
          eq(constructionRecords.subTypeId, subTypeId),
          eq(constructionRecords.phaseTemplateId, phaseTemplateId),
          eq(constructionRecords.inspectionDate, inspectionDate)
        )
      )
      .limit(1);

    // [빈 저장 방어] 내용이 전부 비어 있고 기존 기록도 없으면 새로 만들지 않음
    // (삭제 직후 자동저장이 빈 폼을 새 기록으로 재생성하는 문제 원천 차단)
    const isEmptyValues =
      !values.inspectionContent &&
      !values.textDescription &&
      !values.voiceMemoText &&
      !values.title &&
      values.inspectionPartFromMain == null &&
      values.inspectionPartFromSub == null &&
      values.inspectionPartToMain == null &&
      values.inspectionPartToSub == null &&
      values.latitude == null &&
      values.longitude == null &&
      !values.locationAddress &&
      !values.notApplicable;
    if (isEmptyValues && !existing[0]) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (existing[0]) {
      // 이미 제출/승인된 기록은 자동저장이 status 를 draft 로 되돌리지 않도록 유지
      const prev = existing[0].status;
      const locked = prev === "submitted" || prev === "approved" || prev === "revision_requested";
      const nextValues = locked ? { ...values, status: prev } : values;
      await db
        .update(constructionRecords)
        .set({ ...nextValues, updatedAt: new Date() })
        .where(eq(constructionRecords.id, existing[0].id));
      return NextResponse.json({ ok: true, id: existing[0].id });
    }

    // 동시 자동저장으로 중복 행이 생기지 않도록 UNIQUE 인덱스 기반 upsert
    const [row] = await db
      .insert(constructionRecords)
      .values({ siteId: ss.siteId, siteStructureId, phaseTemplateId, ...values, createdBy: userId })
      .onConflictDoUpdate({
        target: [
          constructionRecords.siteStructureId,
          constructionRecords.subTypeId,
          constructionRecords.phaseTemplateId,
          constructionRecords.inspectionDate,
        ],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    console.error("[records:post]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "기록 저장 오류: " + msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
    const allSubTypes = b.allSubTypes === true;
    if (!siteStructureId || !inspectionDate || (!allSubTypes && !subTypeId)) {
      return NextResponse.json({ error: "구조물/세부항목/검측일자 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    if (!(await ownsSite(userId, ss.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 해당 날짜+공종의 F1~F3 기록 조회
    const recs = await db
      .select({ id: constructionRecords.id })
      .from(constructionRecords)
      .where(
        allSubTypes
          ? and(
              eq(constructionRecords.siteStructureId, siteStructureId),
              eq(constructionRecords.inspectionDate, inspectionDate)
            )
          : and(
              eq(constructionRecords.siteStructureId, siteStructureId),
              eq(constructionRecords.subTypeId, subTypeId),
              eq(constructionRecords.inspectionDate, inspectionDate)
            )
      );
    if (recs.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }
    const recordIds = recs.map((r) => r.id);

    // 자료(사진/영상/지도/도면) 먼저 삭제 (DB 만; 드라이브 원본은 보존)
    for (const rid of recordIds) {
      await db.delete(recordAssets).where(eq(recordAssets.recordId, rid));
    }
    // 기록 삭제
    for (const rid of recordIds) {
      await db.delete(constructionRecords).where(eq(constructionRecords.id, rid));
    }
    return NextResponse.json({ ok: true, deleted: recordIds.length });
  } catch (e) {
    console.error("[records:delete]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "삭제 오류: " + msg }, { status: 500 });
  }
}
