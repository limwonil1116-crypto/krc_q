import { NextResponse } from "next/server";
import { and, eq, ilike, or, desc, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  constructionSites,
  siteStructures,
  constructionRecords,
  inspectionRequests,
  siteParticipants,
} from "@/lib/db/schema";

export const runtime = "nodejs";

// GET /api/admin/users?role=&status=&branch=&q=
// 가입자 명단 + 활동요약 + 필터 (관리자 전용)
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

  // 활동 요약: 사용자별 현장/구조물/검측기록/검측요청/참여 수
  const ids = rows.map((r) => r.id);
  const activity: Record<
    string,
    { sites: number; structures: number; records: number; requests: number; participations: number }
  > = {};
  for (const id of ids) {
    activity[id] = { sites: 0, structures: 0, records: 0, requests: 0, participations: 0 };
  }
  if (ids.length) {
    const [siteRows, structRows, recRows, reqRows, partRows] = await Promise.all([
      db.select({ by: constructionSites.createdBy }).from(constructionSites).where(inArray(constructionSites.createdBy, ids)),
      db.select({ by: siteStructures.createdBy }).from(siteStructures).where(inArray(siteStructures.createdBy, ids)),
      db.select({ by: constructionRecords.createdBy }).from(constructionRecords).where(inArray(constructionRecords.createdBy, ids)),
      db.select({ by: inspectionRequests.createdBy }).from(inspectionRequests).where(inArray(inspectionRequests.createdBy, ids)),
      db.select({ by: siteParticipants.userId }).from(siteParticipants).where(inArray(siteParticipants.userId, ids)),
    ]);
    for (const r of siteRows) if (r.by && activity[r.by]) activity[r.by].sites++;
    for (const r of structRows) if (r.by && activity[r.by]) activity[r.by].structures++;
    for (const r of recRows) if (r.by && activity[r.by]) activity[r.by].records++;
    for (const r of reqRows) if (r.by && activity[r.by]) activity[r.by].requests++;
    for (const r of partRows) if (r.by && activity[r.by]) activity[r.by].participations++;
  }
  const withActivity = rows.map((r) => ({ ...r, activity: activity[r.id] }));

  // 통계 (전체 기준)
  const allRows = await db
    .select({ role: users.role, status: users.status })
    .from(users);
  const stats = {
    total: allRows.length,
    active: allRows.filter((r) => r.status === "active").length,
    suspended: allRows.filter((r) => r.status === "suspended").length,
    contractor: allRows.filter((r) => r.role === "contractor").length,
    krc: allRows.filter((r) => r.role === "supervisor" || r.role === "client").length,
  };
  const branchRows = await db.select({ branch: users.branch }).from(users);
  const branches = Array.from(
    new Set(branchRows.map((r) => r.branch).filter((b): b is string => !!b))
  ).sort();

  return NextResponse.json({ ok: true, users: withActivity, stats, branches });
}

// PATCH /api/admin/users  { id, name?, phone?, branch?, role?, status? }
// 사용자 정보/상태 수정 — 관리자 전용
export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const id = (b.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "대상이 필요합니다." }, { status: 400 });
  }

  const patch: Record<string, any> = { updatedAt: new Date() };
  if (b.name !== undefined) {
    const name = (b.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "이름은 비울 수 없습니다." }, { status: 400 });
    patch.name = name;
  }
  if (b.phone !== undefined) patch.phone = (b.phone ?? "").trim() || null;
  if (b.branch !== undefined) patch.branch = (b.branch ?? "").trim() || null;
  if (b.role !== undefined) {
    const role = (b.role ?? "").trim();
    if (!["contractor", "supervisor", "client", "admin"].includes(role)) {
      return NextResponse.json({ error: "잘못된 소속입니다." }, { status: 400 });
    }
    patch.role = role;
  }
  if (b.status !== undefined) {
    const status = (b.status ?? "").trim();
    if (!["active", "suspended", "deleted"].includes(status)) {
      return NextResponse.json({ error: "잘못된 상태입니다." }, { status: 400 });
    }
    patch.status = status;
  }

  await db.update(users).set(patch).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
