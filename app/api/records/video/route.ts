import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, constructionRecords, recordAssets } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { uploadToDrive, deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";

const COMPOSED_CAPTION = "최종 합성영상";

async function ownsSite(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return { ok: false as const, site: null };
  const orgId = await getMyOrgId(userId);
  const owns = site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
  return { ok: owns, site };
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;

    const fd = await req.formData();
    const siteStructureId = String(fd.get("siteStructureId") || "");
    const inspectionDate = String(fd.get("inspectionDate") || "");
    const file = fd.get("file");
    if (!siteStructureId || !inspectionDate || !(file instanceof File)) {
      return NextResponse.json({ error: "영상/구조물/검측일자 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    const owned = await ownsSite(userId, ss.siteId);
    if (!owned.ok || !owned.site) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 해당 날짜 record 하나 확보 (영상 asset 을 매달 record)
    const recRows = await db
      .select({ id: constructionRecords.id })
      .from(constructionRecords)
      .where(
        and(
          eq(constructionRecords.siteStructureId, siteStructureId),
          eq(constructionRecords.inspectionDate, inspectionDate)
        )
      )
      .limit(1);
    if (!recRows[0]) {
      return NextResponse.json({ error: "해당 검측일자의 기록을 찾을 수 없습니다." }, { status: 404 });
    }
    const recordId = recRows[0].id;

    // 기존 합성영상 교체 (Drive + DB)
    const olds = await db
      .select()
      .from(recordAssets)
      .where(
        and(
          eq(recordAssets.recordId, recordId),
          eq(recordAssets.assetType, "video"),
          eq(recordAssets.caption, COMPOSED_CAPTION),
          isNull(recordAssets.deletedAt)
        )
      );
    for (const old of olds) {
      if (old.storageFileId) {
        try {
          await deleteFromDrive(old.storageFileId);
        } catch {
          // ignore
        }
      }
      await db.delete(recordAssets).where(eq(recordAssets.id, old.id));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "video/webm";
    const driveName = `[최종영상]_${inspectionDate}_${Date.now()}.webm`;
    const siteFolder = `${owned.site.projectName}_${owned.site.districtName}`;
    const folderPath = [siteFolder, ss.name || siteStructureId, inspectionDate];
    const up = await uploadToDrive({ name: driveName, mimeType, buffer, folderPath });

    const [asset] = await db
      .insert(recordAssets)
      .values({
        recordId,
        assetType: "video",
        fileName: driveName,
        fileUrl: up.webViewLink,
        mimeType,
        fileSizeBytes: buffer.length,
        caption: COMPOSED_CAPTION,
        uploadStatus: "uploaded",
        storageProvider: "google_drive",
        storageFileId: up.id,
        createdBy: userId,
      })
      .returning();

    return NextResponse.json({ ok: true, id: asset.id, fileId: up.id });
  } catch (e) {
    console.error("[records:video]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "영상 저장 오류: " + msg }, { status: 500 });
  }
}

// 특정 날짜의 합성영상 저장 여부 조회
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const siteStructureId = searchParams.get("siteStructureId") || "";
    const inspectionDate = searchParams.get("inspectionDate") || "";
    if (!siteStructureId || !inspectionDate) {
      return NextResponse.json({ ok: true, exists: false });
    }
    const recRows = await db
      .select({ id: constructionRecords.id })
      .from(constructionRecords)
      .where(
        and(
          eq(constructionRecords.siteStructureId, siteStructureId),
          eq(constructionRecords.inspectionDate, inspectionDate)
        )
      )
      .limit(1);
    if (!recRows[0]) return NextResponse.json({ ok: true, exists: false });
    const rows = await db
      .select({ id: recordAssets.id })
      .from(recordAssets)
      .where(
        and(
          eq(recordAssets.recordId, recRows[0].id),
          eq(recordAssets.assetType, "video"),
          eq(recordAssets.caption, COMPOSED_CAPTION),
          isNull(recordAssets.deletedAt)
        )
      )
      .limit(1);
    return NextResponse.json({ ok: true, exists: !!rows[0] });
  } catch {
    return NextResponse.json({ ok: true, exists: false });
  }
}
