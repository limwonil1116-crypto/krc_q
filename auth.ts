import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Kakao from "next-auth/providers/kakao";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const providers = [
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;
      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const u = rows[0];
      if (!u || !u.passwordHash) return null;
      if (u.status !== "active") return null;
      const ok = await bcrypt.compare(password, u.passwordHash);
      if (!ok) return null;
      return { id: u.id, email: u.email ?? undefined, name: u.name, role: u.role };
    },
  }),
  // 카카오 키가 있을 때만 provider 추가 (없으면 이메일 로그인만 동작)
  ...(process.env.AUTH_KAKAO_ID ? [Kakao] : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      // 카카오 로그인: kakao_id 로 사용자 조회/생성(스텁)
      if (account?.provider === "kakao") {
        const kakaoId = String(account.providerAccountId);
        const rows = await db.select().from(users).where(eq(users.kakaoId, kakaoId)).limit(1);
        let u = rows[0];
        if (!u) {
          const ins = await db
            .insert(users)
            .values({
              kakaoId,
              name: (user?.name as string) ?? "카카오사용자",
              role: "contractor",
              status: "pending", // 온보딩 전 상태
            })
            .returning();
          u = ins[0];
        }
        token.id = u.id;
        token.role = u.role;
        token.status = u.status;
        token.name = u.name;
        return token;
      }
      // 이메일/비번 로그인
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
        token.status = "active";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { status?: string }).status = token.status as string;
      }
      return session;
    },
  },
});
