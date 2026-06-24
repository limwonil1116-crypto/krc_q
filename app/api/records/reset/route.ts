import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, constructionRecords, recordAssets } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";

async function ownsSite(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return false;
  const orgId = await getMyOrgId(userId);
  return site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
}

// 한 단계(구조물x세부항목x검측일자x단계)의 기록 행 + 첨부(드라이브 포함) 삭제 -> 미작성으로 초기화
export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;

    const b = await req.json();
    const siteStructureId = (b.siteStructureId ?? "").trim();
    const subTypeId = (b.subTypeId ?? "").trim();
    const phaseTemplateId = (b.phaseTemplateId ?? "").trim();
    const inspectionDate = (b.inspectionDate ?? "").trim();
    if (!siteStructureId || !subTypeId || !phaseTemplateId || !inspectionDate) {
      return NextResponse.json({ error: "구조물/세부항목/단계/검측일자 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    if (!(await ownsSite(userId, ss.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 대상 기록 행들
    const recs = await db
      .select({ id: constructionRecords.id })
      .from(constructionRecords)
      .where(
        and(
          eq(constructionRecords.siteStructureId, siteStructureId),
          eq(constructionRecords.subTypeId, subTypeId),
          eq(constructionRecords.phaseTemplateId, phaseTemplateId),
          eq(constructionRecords.inspectionDate, inspectionDate)
        )
      );

    for (const r of recs) {
      // 첨부 파일: 드라이브에서 삭제 시도 후 행 삭제(cascade로도 지워지지만 드라이브는 수동)
      const assets = await db
        .select({ id: recordAssets.id, storageFileId: recordAssets.storageFileId })
        .from(recordAssets)
        .where(eq(recordAssets.recordId, r.id));
      for (const a of assets) {
        if (a.storageFileId) {
          try {
            await deleteFromDrive(a.storageFileId);
          } catch (e) {
            console.error("[records:reset] drive delete fail", e);
          }
        }
      }
      // 기록 행 삭제 (record_assets 는 cascade 로 함께 삭제)
      await db.delete(constructionRecords).where(eq(constructionRecords.id, r.id));
    }

    return NextResponse.json({ ok: true, deleted: recs.length });
  } catch (e) {
    console.error("[records:reset]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "초기화 오류: " + msg }, { status: 500 });
  }
}
