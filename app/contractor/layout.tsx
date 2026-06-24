import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { BottomNav } from "@/components/kit/bottom-nav";

export default async function RoleLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "contractor") redirect("/");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0033A0] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/krc-logo-white.png" alt="한국농어촌공사" className="h-5 w-auto sm:h-6" />
          <span className="hidden text-sm text-white/80 sm:inline">· 시공사</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>{session.user.name}</span>
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
      <main className="mx-auto max-w-5xl p-4 pb-24">{children}</main>
      <BottomNav home="/contractor" />
    </div>
  );
}
