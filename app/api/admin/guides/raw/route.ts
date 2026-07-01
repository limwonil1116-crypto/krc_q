import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { guideAssets } from "@/lib/db/schema";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new Response("forbidden", { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  if (!assetId) return new Response("bad request", { status: 400 });

  const rows = await db
    .select({ storageFileId: guideAssets.storageFileId, mimeType: guideAssets.mimeType })
    .from(guideAssets)
    .where(eq(guideAssets.id, assetId))
    .limit(1);
  const a = rows[0];
  if (!a?.storageFileId) return new Response("not found", { status: 404 });

  try {
    const stream = await getDriveStream(a.storageFileId);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    const buf = Buffer.concat(chunks);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": a.mimeType || "image/jpeg", "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new Response("stream error", { status: 500 });
  }
}
