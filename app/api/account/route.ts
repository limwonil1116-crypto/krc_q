import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      status: users.status,
      kakaoId: users.kakaoId,
      hasPassword: users.passwordHash,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const u = rows[0];
  if (!u) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      status: u.status,
      isKakao: !!u.kakaoId,
      hasPassword: !!u.hasPassword,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }
  let body: {
    name?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const me = rows[0];
  if (!me) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // 이름
  if (typeof body.name === "string") {
    const nm = body.name.trim();
    if (!nm) {
      return NextResponse.json({ ok: false, error: "이름을 입력하세요." }, { status: 400 });
    }
    updates.name = nm;
  }
  // 전화
  if (typeof body.phone === "string") {
    updates.phone = body.phone.trim() || null;
  }

  // 비밀번호 변경 (요청 시)
  if (body.newPassword) {
    if (!me.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "카카오 로그인 계정은 비밀번호를 설정할 수 없습니다." },
        { status: 400 }
      );
    }
    if (body.newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: "새 비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }
    const okPw = body.currentPassword
      ? await bcrypt.compare(body.currentPassword, me.passwordHash)
      : false;
    if (!okPw) {
      return NextResponse.json({ ok: false, error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
