import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, organizations, organizationMembers } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const userId = session.user.id;

    const b = await req.json();
    const role = b.role === "client" ? "client" : "contractor";
    const name = (b.name ?? "").trim();
    const email = (b.email ?? "").trim().toLowerCase();
    const password = b.password ?? "";
    const phone = (b.phone ?? "").trim();
    const headquarters = (b.headquarters ?? "").trim();
    const branch = (b.branch ?? "").trim();
    const companyName = role === "client" ? "한국농어촌공사" : (b.companyName ?? "").trim();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "성명/이메일/비밀번호는 필수입니다." }, { status: 400 });
    }
    if (role === "contractor" && !companyName) {
      return NextResponse.json({ error: "회사명을 입력해 주세요." }, { status: 400 });
    }
    if (role === "client" && !branch) {
      return NextResponse.json({ error: "지사를 선택해 주세요." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const dup = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (dup[0] && dup[0].id !== userId) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const orgType = role === "client" ? "client_agency" : "contractor";

    const [org] = await db
      .insert(organizations)
      .values({
        name: companyName,
        type: orgType,
        status: "active",
        headquarters: role === "client" ? (headquarters || "충남") : null,
        branch: role === "client" ? branch : null,
      })
      .returning();

    await db
      .update(users)
      .set({ email, passwordHash, name, phone: phone || null, role, status: "active" })
      .where(eq(users.id, userId));

    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      memberRole: "owner",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[onboarding] error:", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "가입 처리 오류: " + msg }, { status: 500 });
  }
}
