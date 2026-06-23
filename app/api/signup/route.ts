import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, organizations, organizationMembers } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName = (body.companyName ?? "").trim();
    const businessNumber = (body.businessNumber ?? "").trim();
    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!companyName || !name || !email || !password) {
      return NextResponse.json({ error: "필수 항목을 모두 입력해 주세요." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [org] = await db
      .insert(organizations)
      .values({
        name: companyName,
        type: "contractor",
        businessNumber: businessNumber || null,
        status: "pending",
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        phone: phone || null,
        role: "contractor",
        status: "pending",
      })
      .returning();

    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      memberRole: "owner",
    });

    return NextResponse.json({
      ok: true,
      message: "가입 신청이 완료되었습니다. 운영자 승인 후 로그인할 수 있습니다.",
    });
  } catch (e) {
    console.error("signup error", e);
    return NextResponse.json({ error: "가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
