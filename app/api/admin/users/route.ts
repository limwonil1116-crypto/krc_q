import { NextResponse } from "next/server";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const runtime = "nodejs";

// GET /api/admin/users?role=&status=&branch=&q=
// 가입자 명단 조회 + 필터 (관리자 전용)
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const role = (searchParams.get("role") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const branch = (searchParams.get("branch") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();

  const conds = [] as any[];
  if (role) conds.push(eq(users.role, role as any));
  if (status) conds.push(eq(users.status, status as any));
  if (branch) conds.push(eq(users.branch, branch));
  if (q) {
    conds.push(
      or(
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
        ilike(users.phone, `%${q}%`)
      )
    );
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      branch: users.branch,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(users.createdAt));

  // 통계 (필터 무관 전체 기준)
  const allRows = await db
    .select({ role: users.role, status: users.status, branch: users.branch })
    .from(users);
  const stats = {
    total: allRows.length,
    pending: allRows.filter((r) => r.status === "pending").length,
    active: allRows.filter((r) => r.status === "active").length,
    contractor: allRows.filter((r) => r.role === "contractor").length,
    krc: allRows.filter((r) => r.role === "supervisor" || r.role === "client").length,
  };
  const branches = Array.from(
    new Set(allRows.map((r) => r.branch).filter((b): b is string => !!b))
  ).sort();

  return NextResponse.json({ ok: true, users: rows, stats, branches });
}

// PATCH /api/admin/users  { id, status }
// 사용자 상태 변경 (승인/정지 등) — 관리자 전용
export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const id = (b.id ?? "").trim();
  const status = (b.status ?? "").trim();
  const allowed = ["pending", "active", "suspended", "deleted"];
  if (!id || !allowed.includes(status)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await db
    .update(users)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
