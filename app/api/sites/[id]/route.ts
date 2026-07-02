import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { getMyBranch, isHeadOffice } from "@/lib/perm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client" && role !== "admin")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;
    const orgId = await getMyOrgId(userId);

    const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, id)).limit(1);
    const site = rows[0];
    if (!site) {
      return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });
    }
    const owns =
      site.createdBy === userId ||
      (orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
    if (!owns) {
      return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
    }

    const b = await req.json();
    const districtName = (b.districtName ?? "").trim();
    const projectName = (b.projectName ?? "").trim();
    const address = (b.address ?? "").trim();
    if (!districtName || !projectName || !address) {
      return NextResponse.json({ error: "지구명/사업/주소는 필수입니다." }, { status: 400 });
    }

    await db
      .update(constructionSites)
      .set({
        clientOrgId: role === "contractor" ? (b.clientOrgId || null) : site.clientOrgId,
        siteCode: (b.siteCode ?? "").trim() || null,
        districtName,
        projectName,
        executor: (b.executor ?? "").trim() || null,
        workType: (b.workType ?? "").trim() || null,
        workTypes: (b.workTypes ?? "").trim() || null,
        contractorCompany: (b.contractorCompany ?? "").trim() || null,
        siteManagerName: (b.siteManagerName ?? "").trim() || null,
        siteManagerPhone: (b.siteManagerPhone ?? "").trim() || null,
        siteManagerEmail: (b.siteManagerEmail ?? "").trim() || null,
        address,
        lat: b.lat != null ? String(b.lat) : null,
        lng: b.lng != null ? String(b.lng) : null,
        startedOn: b.startedOn || null,
        endedOn: b.endedOn || null,
        supervisorName: (b.supervisorName ?? "").trim() || null,
        supervisorPhone: (b.supervisorPhone ?? "").trim() || null,
        supervisorEmail: (b.supervisorEmail ?? "").trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(constructionSites.id, id));

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[sites:patch] error:", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "현장 수정 오류: " + msg }, { status: 500 });
  }
}
