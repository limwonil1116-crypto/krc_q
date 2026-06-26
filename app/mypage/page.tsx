import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { MypageForm } from "@/components/account/mypage-form";

export const runtime = "nodejs";

const ROLE_LABEL: Record<string, string> = {
  contractor: "시공사",
  supervisor: "공감소장",
  client: "한국농어촌공사",
  admin: "운영관리자",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "승인대기",
  active: "활성",
  suspended: "정지",
  deleted: "삭제됨",
};

export default async function MyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const u = rows[0];
  if (!u) redirect("/login");

  const home =
    u.role === "admin"
      ? "/admin"
      : u.role === "client"
      ? "/client"
      : u.role === "supervisor"
      ? "/supervisor"
      : "/contractor";

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0033A0] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/krc-logo-white.png" alt="한국농어촌공사" className="h-5 w-auto sm:h-6" />
          <span className="hidden text-sm text-white/80 sm:inline">· 마이페이지</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={home} className="rounded bg-white/15 px-3 py-1 hover:bg-white/25">
            ← 돌아가기
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded bg-white/15 px-3 py-1 hover:bg-white/25">로그아웃</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-md p-4 pb-24">
        <h1 className="mb-1 text-xl font-bold text-[#0033A0]">내 정보</h1>
        <p className="mb-4 text-sm text-neutral-500">가입 시 입력한 정보를 확인하고 수정할 수 있습니다.</p>

        {/* 조회 전용 정보 */}
        <div className="mb-4 space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">아이디(이메일)</span>
            <span className="font-medium text-[#0A2540]">{u.email || (u.kakaoId ? "카카오 로그인" : "-")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">분류</span>
            <span className="font-medium text-[#0A2540]">{ROLE_LABEL[u.role] || u.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">상태</span>
            <span className="font-medium text-[#0A2540]">{STATUS_LABEL[u.status] || u.status}</span>
          </div>
        </div>

        <MypageForm
          initial={{ name: u.name, phone: u.phone ?? "" }}
          hasPassword={!!u.passwordHash}
        />
      </main>
    </div>
  );
}
