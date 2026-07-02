import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, constructionRecords, recordAssets } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";

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

export async function DELETE(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params;
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client" && role !== "admin")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const aRows = await db.select().from(recordAssets).where(eq(recordAssets.id, assetId)).limit(1);
    const a = aRows[0];
    if (!a) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

    const rRows = await db
      .select({ siteId: constructionRecords.siteId })
      .from(constructionRecords)
      .where(eq(constructionRecords.id, a.recordId))
      .limit(1);
    const rec = rRows[0];
    if (!rec || !(await ownsSite(session.user.id, rec.siteId))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    if (a.storageFileId) {
      try {
        await deleteFromDrive(a.storageFileId);
      } catch (e) {
        console.error("[assets:delete] drive", e);
      }
    }
    await db.delete(recordAssets).where(eq(recordAssets.id, assetId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[assets:delete]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "삭제 오류: " + msg }, { status: 500 });
  }
}
