import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  constructionSites,
  siteStructures,
  constructionRecords,
  recordAssets,
  siteParticipants,
} from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";
const COMPOSED_CAPTION = "최종 합성영상";

async function ownsSite(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return { ok: false as const, site: null };
  const orgId = await getMyOrgId(userId);
  let owns =
    site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
  if (!owns) {
    const part = await db
      .select({ id: siteParticipants.id })
      .from(siteParticipants)
      .where(and(eq(siteParticipants.siteId, siteId), eq(siteParticipants.userId, userId)))
      .limit(1);
    owns = !!part[0];
  }
  return { ok: owns, site };
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
    const inspectionDate = (b.inspectionDate ?? "").trim();
    const fileId = (b.fileId ?? "").trim();
    const fileName = (b.fileName ?? "video.webm").trim();
    const webViewLink = (b.webViewLink ?? "").trim();
    const fileSizeBytes = typeof b.fileSizeBytes === "number" ? b.fileSizeBytes : 0;
    if (!siteStructureId || !inspectionDate || !fileId) {
      return NextResponse.json({ error: "구조물/검측일자/파일 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    const owned = await ownsSite(userId, ss.siteId);
    if (!owned.ok || !owned.site) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
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
    if (!recRows[0]) {
      return NextResponse.json({ error: "해당 검측일자의 기록을 찾을 수 없습니다." }, { status: 404 });
    }
    const recordId = recRows[0].id;

    // 기존 합성영상 교체 (Drive + DB)
    const olds = await db
      .select({ id: recordAssets.id, storageFileId: recordAssets.storageFileId })
      .from(recordAssets)
      .where(
        and(
          eq(recordAssets.recordId, recordId),
          eq(recordAssets.caption, COMPOSED_CAPTION),
          isNull(recordAssets.deletedAt)
        )
      );
    for (const old of olds) {
      if (old.storageFileId && old.storageFileId !== fileId) {
        try {
          await deleteFromDrive(old.storageFileId);
        } catch {
          // ignore
        }
      }
      await db.delete(recordAssets).where(eq(recordAssets.id, old.id));
    }

    const [asset] = await db
      .insert(recordAssets)
      .values({
        recordId,
        assetType: "video",
        fileName,
        fileUrl: webViewLink,
        mimeType: "video/webm",
        fileSizeBytes,
        caption: COMPOSED_CAPTION,
        uploadStatus: "uploaded",
        storageProvider: "google_drive",
        storageFileId: fileId,
        createdBy: userId,
      })
      .returning();
    return NextResponse.json({ ok: true, id: asset.id, fileId });
  } catch (e) {
    console.error("[records:video:complete]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "영상 등록 오류: " + msg }, { status: 500 });
  }
}
