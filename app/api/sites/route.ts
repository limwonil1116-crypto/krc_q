import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteParticipants } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client" && role !== "admin")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;
    const orgId = await getMyOrgId(userId);
    if (!orgId) {
      return NextResponse.json({ error: "소속 기관 정보를 찾을 수 없습니다." }, { status: 400 });
    }

    const b = await req.json();
    const districtName = (b.districtName ?? "").trim();
    const projectName = (b.projectName ?? "").trim();
    const address = (b.address ?? "").trim();
    if (!districtName || !projectName || !address) {
      return NextResponse.json({ error: "지구명/사업/주소는 필수입니다." }, { status: 400 });
    }

    const [site] = await db
      .insert(constructionSites)
      .values({
        clientOrgId: role === "client" ? orgId : (b.clientOrgId || null),
        contractorOrgId: role === "contractor" ? orgId : null,
        siteCode: (b.siteCode ?? "").trim() || null,
        districtName,
        projectName,
        executor: (b.executor ?? "").trim() || null,
        workType: (b.workType ?? "").trim() || null,
        workTypes: (b.workTypes ?? "").trim() || null,
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
        status: "active",
        createdBy: userId,
      })
      .returning();

    await db.insert(siteParticipants).values({
      siteId: site.id,
      userId,
      participantRole: role === "client" ? "client_manager" : "contractor_manager",
    });

    return NextResponse.json({ ok: true, id: site.id });
  } catch (e) {
    console.error("[sites] error:", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "현장 저장 오류: " + msg }, { status: 500 });
  }
}
