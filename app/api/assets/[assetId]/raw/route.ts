import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, constructionRecords, recordAssets } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canView(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return false;
  const orgId = await getMyOrgId(userId);
  return site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
}

export async function GET(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const aRows = await db.select().from(recordAssets).where(eq(recordAssets.id, assetId)).limit(1);
  const a = aRows[0];
  if (!a || !a.storageFileId) return new Response("Not found", { status: 404 });

  const rRows = await db
    .select({ siteId: constructionRecords.siteId })
    .from(constructionRecords)
    .where(eq(constructionRecords.id, a.recordId))
    .limit(1);
  const rec = rRows[0];
  if (!rec || !(await canView(session.user.id, rec.siteId))) {
    return new Response("Forbidden", { status: 403 });
  }

  const nodeStream = await getDriveStream(a.storageFileId);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": a.mimeType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
