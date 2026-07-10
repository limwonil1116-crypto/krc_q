import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  constructionSites,
  siteStructures,
  inspectionRequests,
  checklists,
  checklistItems,
  constructionRecords,
  recordAssets,
} from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

export const runtime = "nodejs";

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
  return site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
}

// GET: 특정 구조물의 검측 요청 목록 또는 특정 요청 상세
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const structureId = searchParams.get("structureId");

    if (id) {
      const reqRows = await db.select().from(inspectionRequests).where(eq(inspectionRequests.id, id)).limit(1);
      const ir = reqRows[0];
      if (!ir) return NextResponse.json({ error: "요청서를 찾을 수 없습니다." }, { status: 404 });
      const cls = await db.select().from(checklists).where(eq(checklists.inspectionRequestId, id)).orderBy(checklists.sortOrder);
      // 각 체크리스트의 항목 조회
      const checklistsWithItems = [];
      for (const cl of cls) {
        const its = await db
          .select()
          .from(checklistItems)
          .where(eq(checklistItems.checklistId, cl.id))
          .orderBy(checklistItems.sortOrder);
        checklistsWithItems.push({ ...cl, items: its });
      }

      // 연계 자료: 같은 구조물+날짜의 사진/영상/도면/지도
      const assetRows = await db
        .select({
          id: recordAssets.id,
          assetType: recordAssets.assetType,
          fileName: recordAssets.fileName,
          mimeType: recordAssets.mimeType,
          caption: recordAssets.caption,
          inspectionDate: constructionRecords.inspectionDate,
        })
        .from(recordAssets)
        .innerJoin(constructionRecords, eq(recordAssets.recordId, constructionRecords.id))
        .where(
          and(
            eq(constructionRecords.siteStructureId, ir.siteStructureId),
            eq(recordAssets.uploadStatus, "uploaded")
          )
        )
        .orderBy(recordAssets.sortOrder);

      const assets = ir.inspectionDate
        ? assetRows.filter((a) => a.inspectionDate === ir.inspectionDate)
        : assetRows;

      return NextResponse.json({
        ok: true,
        request: ir,
        checklists: checklistsWithItems,
        assets: assets.map((a) => ({
          id: a.id,
          assetType: a.assetType,
          fileName: a.fileName,
          mimeType: a.mimeType,
          caption: a.caption,
          url: `/api/assets/${a.id}/raw`,
        })),
      });
    }

    if (structureId) {
      const rows = await db
        .select()
        .from(inspectionRequests)
        .where(eq(inspectionRequests.siteStructureId, structureId))
        .orderBy(desc(inspectionRequests.inspectionDate));
      return NextResponse.json({ ok: true, requests: rows });
    }

    return NextResponse.json({ error: "structureId 또는 id 가 필요합니다." }, { status: 400 });
  } catch (e) {
    console.error("[inspections:get]", e);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

// POST: 검측 요청서 저장 (요청서 + 체크리스트 + 항목)
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
    if (!siteStructureId) {
      return NextResponse.json({ error: "구조물 정보가 필요합니다." }, { status: 400 });
    }
    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    if (!(await ownsSite(userId, ss.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const inspectionDate = (b.inspectionDate ?? "").trim() || todayStr();
    const reqValues = {
      subTypeId: (b.subTypeId ?? "").trim() || null,
      inspectionDate,
      requestNo: (b.requestNo ?? "").trim() || null,
      locationWork: (b.locationWork ?? "").trim() || null,
      inspectionPart: (b.inspectionPart ?? "").trim() || null,
      requiredAt: b.requiredAt ? new Date(b.requiredAt) : null,
      inspectionMatter: (b.inspectionMatter ?? "").trim() || null,
      isRecheck: !!b.isRecheck,
      contractorAgentName: (b.contractorAgentName ?? "").trim() || null,
      contractorCheckerName: (b.contractorCheckerName ?? "").trim() || null,
      supervisorId: (b.supervisorId ?? "").trim() || null,
    };

    // 제출 여부: submit=true 이면 감독원 지정 필수
    const doSubmit = b.submit === true;
    if (doSubmit && !reqValues.supervisorId) {
      return NextResponse.json({ error: "제출하려면 공사감독원을 지정해야 합니다." }, { status: 400 });
    }

    // 기존 요청서 (id 있으면 업데이트)
    const existingId = (b.id ?? "").trim();
    let requestId: string;
    if (existingId) {
      await db
        .update(inspectionRequests)
        .set({
          ...reqValues,
          ...(doSubmit ? { status: "submitted" as const, contractorSignedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(inspectionRequests.id, existingId));
      requestId = existingId;
    } else {
      const [row] = await db
        .insert(inspectionRequests)
        .values({
          siteId: ss.siteId,
          siteStructureId,
          ...reqValues,
          status: doSubmit ? ("submitted" as const) : ("draft" as const),
          ...(doSubmit ? { contractorSignedAt: new Date() } : {}),
          createdBy: userId,
        })
        .returning();
      requestId = row.id;
    }

    // 체크리스트 저장 (전체 교체 방식: 기존 삭제 후 재삽입)
    if (Array.isArray(b.checklists)) {
      await db.delete(checklists).where(eq(checklists.inspectionRequestId, requestId));
      let clOrder = 0;
      for (const cl of b.checklists) {
        const [clRow] = await db
          .insert(checklists)
          .values({
            inspectionRequestId: requestId,
            facilityName: (cl.facilityName ?? "").trim() || null,
            locationPart: (cl.locationPart ?? "").trim() || null,
            workName: (cl.workName ?? "").trim() || null,
            quantity: (cl.quantity ?? "").trim() || null,
            stage: (cl.stage ?? "").trim() || null,
            aiGenerated: !!cl.aiGenerated,
            aiSource: (cl.aiSource ?? "").trim() || null,
            sortOrder: clOrder++,
          })
          .returning();
        if (Array.isArray(cl.items)) {
          let itOrder = 0;
          for (const it of cl.items) {
            await db.insert(checklistItems).values({
              checklistId: clRow.id,
              itemNo: typeof it.itemNo === "number" ? it.itemNo : itOrder + 1,
              checkItem: (it.checkItem ?? it.check_item ?? "").trim(),
              standard: (it.standard ?? "").trim() || null,
              contractorResult: (it.contractorResult ?? "").trim() || null,
              contractorNote: (it.contractorNote ?? "").trim() || null,
              supervisorResult: (it.supervisorResult ?? "").trim() || null,
              supervisorNote: (it.supervisorNote ?? "").trim() || null,
              sortOrder: itOrder++,
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, id: requestId });
  } catch (e) {
    console.error("[inspections:post]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "저장 오류: " + msg }, { status: 500 });
  }
}
