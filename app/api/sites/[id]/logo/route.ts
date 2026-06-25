import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { uploadToDrive, deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";

async function ownsSite(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return { ok: false as const };
  const orgId = await getMyOrgId(userId);
  const owns =
    site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
  return { ok: owns, site };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;
    const owned = await ownsSite(userId, id);
    if (!owned.ok || !owned.site) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "로고 이미지 파일이 필요합니다." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "로고는 4MB 이하 이미지만 가능합니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/png";
    const cleanName = (file.name || "logo.png").replace(/[\\/]/g, "_");
    const driveName = `logo_${id}_${Date.now()}_${cleanName}`;
    const up = await uploadToDrive({ name: driveName, mimeType, buffer });

    // 기존 로고가 있으면 드라이브에서 제거
    const oldId = owned.site.contractorLogoDriveId;

    await db
      .update(constructionSites)
      .set({ contractorLogoDriveId: up.id, contractorLogoName: cleanName, updatedAt: new Date() })
      .where(eq(constructionSites.id, id));

    if (oldId && oldId !== up.id) {
      try {
        await deleteFromDrive(oldId);
      } catch {
        // 기존 파일 삭제 실패는 무시
      }
    }

    return NextResponse.json({ ok: true, name: cleanName });
  } catch (e) {
    console.error("[site:logo:post]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "로고 업로드 오류: " + msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;
    const owned = await ownsSite(userId, id);
    if (!owned.ok || !owned.site) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const oldId = owned.site.contractorLogoDriveId;
    await db
      .update(constructionSites)
      .set({ contractorLogoDriveId: null, contractorLogoName: null, updatedAt: new Date() })
      .where(eq(constructionSites.id, id));
    if (oldId) {
      try {
        await deleteFromDrive(oldId);
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[site:logo:delete]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "로고 삭제 오류: " + msg }, { status: 500 });
  }
}
