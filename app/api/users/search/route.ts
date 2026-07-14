import { NextResponse } from "next/server";
import { and, eq, ilike, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, organizationMembers, organizations } from "@/lib/db/schema";

export const runtime = "nodejs";

// GET /api/users/search?name=홍길동
// 이름으로 유저 검색 (참여자 초대용). 로그인 필요.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ ok: true, users: [] });
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      branch: users.branch,
    })
    .from(users)
    .where(
      and(
        ilike(users.name, `%${name}%`),
        ne(users.id, session.user.id),
        eq(users.status, "active")
      )
    )
    .limit(20);

  // 각 유저의 소속 조직명 조회 (표시용)
  const result = [];
  for (const u of rows) {
    let orgName: string | null = null;
    const om = await db
      .select({ name: organizations.name, type: organizations.type })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, u.id))
      .limit(1);
    if (om[0]) orgName = om[0].name;

    const roleLabel =
      u.role === "contractor"
        ? "시공사"
        : u.role === "client" || u.role === "supervisor"
        ? "한국농어촌공사"
        : u.role === "admin"
        ? "관리자"
        : u.role;

    result.push({
      id: u.id,
      name: u.name,
      role: u.role,
      roleLabel,
      branch: u.branch,
      orgName,
      affiliation: orgName || u.branch || roleLabel,
    });
  }

  return NextResponse.json({ ok: true, users: result });
}
