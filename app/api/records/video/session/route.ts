import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, siteParticipants } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { createResumableSession } from "@/lib/drive";

export const runtime = "nodejs";

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
    const mimeType = (b.mimeType ?? "video/webm").trim();
    if (!siteStructureId || !inspectionDate) {
      return NextResponse.json({ error: "구조물/검측일자 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    const owned = await ownsSite(userId, ss.siteId);
    if (!owned.ok || !owned.site) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const driveName = `[최종영상]_${inspectionDate}_${Date.now()}.webm`;
    const siteFolder = `${owned.site.projectName}_${owned.site.districtName}`;
    const folderPath = [siteFolder, ss.name || siteStructureId, inspectionDate];

    const made = await createResumableSession({ name: driveName, mimeType, folderPath });
    if (!made) {
      return NextResponse.json({ error: "드라이브 업로드 세션 생성 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, uploadUrl: made.uploadUrl, driveName });
  } catch (e) {
    console.error("[records:video:session]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "세션 생성 오류: " + msg }, { status: 500 });
  }
}
