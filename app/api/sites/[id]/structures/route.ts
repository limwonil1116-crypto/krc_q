import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

async function canEdit(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return { ok: false as const, status: 404, error: "현장을 찾을 수 없습니다." };
  const orgId = await getMyOrgId(userId);
  const owns =
    site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
  if (!owns) return { ok: false as const, status: 403, error: "권한이 없습니다." };
  return { ok: true as const, status: 200, error: "" };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const chk = await canEdit(session.user.id, id);
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status });

    const b = await req.json();
    const structureTypeId = (b.structureTypeId ?? "").trim();
    const name = (b.name ?? "").trim();
    if (!structureTypeId || !name) {
      return NextResponse.json({ error: "구조물 종류와 이름은 필수입니다." }, { status: 400 });
    }

    const [row] = await db
      .insert(siteStructures)
      .values({
        siteId: id,
        structureTypeId,
        name,
        locationDescription: (b.locationDescription ?? "").trim() || null,
        status: "active",
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    console.error("[structures:post]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "구조물 추가 오류: " + msg }, { status: 500 });
  }
}
