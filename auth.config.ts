import type { NextAuthConfig } from "next-auth";

const PROTECTED = ["contractor", "supervisor", "client", "admin"];

// 미들웨어(엣지)에서도 import 되므로 여기에는 bcrypt/db 를 절대 넣지 않는다.
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  cookies: {
    // OAuth(카카오) 왕복 중 PKCE/state 검증값이 유실되지 않도록 명시
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 900 },
    },
    state: {
      name: "authjs.state",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 900 },
    },
    nonce: {
      name: "authjs.nonce",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
  },
  providers: [], // 실제 provider 는 auth.ts 에서 추가
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const seg = nextUrl.pathname.split("/")[1];
      if (PROTECTED.includes(seg)) {
        if (!isLoggedIn) return false; // -> /login 으로 리다이렉트
        if (role && seg !== role) {
          return Response.redirect(new URL("/" + role, nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
