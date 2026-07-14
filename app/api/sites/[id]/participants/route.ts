import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteParticipants, users, organizationMembers, organizations } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

export const runtime = "nodejs";

// 현장 소유(초대/내보내기 권한) 판단: 만든 사람 또는 조직, client/admin
async function canManage(userId: string, siteId: string, role?: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return { ok: false as const, site: null };
  if (role === "client" || role === "admin") return { ok: true as const, site };
  const orgId = await getMyOrgId(userId);
  const owns =
    site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
  return { ok: owns, site };
}

// GET: 참여자 목록
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rows = await db
    .select({
      id: siteParticipants.id,
      userId: siteParticipants.userId,
      participantRole: siteParticipants.participantRole,
      name: users.name,
      role: users.role,
      branch: users.branch,
    })
    .from(siteParticipants)
    .innerJoin(users, eq(siteParticipants.userId, users.id))
    .where(eq(siteParticipants.siteId, siteId));

  const siteRows = await db
    .select({ createdBy: constructionSites.createdBy })
    .from(constructionSites)
    .where(eq(constructionSites.id, siteId))
    .limit(1);
  const createdBy = siteRows[0]?.createdBy ?? null;

  const participants = [];
  for (const r of rows) {
    let orgName: string | null = null;
    const om = await db
      .select({ name: organizations.name })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, r.userId))
      .limit(1);
    if (om[0]) orgName = om[0].name;

    const roleLabel =
      r.role === "contractor"
        ? "시공사"
        : r.role === "client" || r.role === "supervisor"
        ? "한국농어촌공사"
        : r.role === "admin"
        ? "관리자"
        : r.role;

    participants.push({
      id: r.id,
      userId: r.userId,
      name: r.name,
      participantRole: r.participantRole,
      roleLabel,
      affiliation: orgName || r.branch || roleLabel,
      isOwner: r.userId === createdBy,
    });
  }

  return NextResponse.json({ ok: true, participants });
}

// POST: 참여자 초대 (body: { userId })
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const perm = await canManage(session.user.id, siteId, role);
  if (!perm.site) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });
  if (!perm.ok) return NextResponse.json({ error: "참여자를 초대할 권한이 없습니다." }, { status: 403 });

  const b = await req.json();
  const targetUserId = (b.userId ?? "").trim();
  if (!targetUserId) return NextResponse.json({ error: "초대할 사용자를 선택하세요." }, { status: 400 });

  // 대상 유저 확인
  const uRows = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, targetUserId)).limit(1);
  const target = uRows[0];
  if (!target) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  // 이미 참여자인지
  const dup = await db
    .select({ id: siteParticipants.id })
    .from(siteParticipants)
    .where(and(eq(siteParticipants.siteId, siteId), eq(siteParticipants.userId, targetUserId)))
    .limit(1);
  if (dup[0]) return NextResponse.json({ error: "이미 참여 중인 사용자입니다." }, { status: 409 });

  // 역할 결정: 시공사=contractor_manager, 농어촌공사(client/supervisor)=supervisor
  const participantRole =
    target.role === "contractor" ? "contractor_manager" : "supervisor";

  await db.insert(siteParticipants).values({
    siteId,
    userId: targetUserId,
    participantRole,
  });

  return NextResponse.json({ ok: true, participantRole });
}

// DELETE: 참여자 내보내기 (body: { userId })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const perm = await canManage(session.user.id, siteId, role);
  if (!perm.site) return NextResponse.json({ error: "현장을 찾을 수 없습니다." }, { status: 404 });
  if (!perm.ok) return NextResponse.json({ error: "참여자를 내보낼 권한이 없습니다." }, { status: 403 });

  const b = await req.json();
  const targetUserId = (b.userId ?? "").trim();
  if (!targetUserId) return NextResponse.json({ error: "대상을 선택하세요." }, { status: 400 });

  // 현장 만든 사람은 내보낼 수 없음
  if (perm.site.createdBy === targetUserId) {
    return NextResponse.json({ error: "현장을 만든 사람은 내보낼 수 없습니다." }, { status: 400 });
  }

  await db
    .delete(siteParticipants)
    .where(and(eq(siteParticipants.siteId, siteId), eq(siteParticipants.userId, targetUserId)));

  return NextResponse.json({ ok: true });
}
