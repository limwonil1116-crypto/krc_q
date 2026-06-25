import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { constructionSites } from "@/lib/db/schema";
import { getDriveStream } from "@/lib/drive";
import { Readable } from "node:stream";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db
    .select({ driveId: constructionSites.contractorLogoDriveId })
    .from(constructionSites)
    .where(eq(constructionSites.id, id))
    .limit(1);
  const driveId = rows[0]?.driveId;
  if (!driveId) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const nodeStream = await getDriveStream(driveId);
    const webStream = Readable.toWeb(nodeStream as unknown as Readable) as unknown as ReadableStream;
    return new Response(webStream, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("[site:logo:raw]", e);
    return new Response("Error", { status: 500 });
  }
}
