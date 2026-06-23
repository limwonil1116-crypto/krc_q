import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { BottomNav } from "@/components/kit/bottom-nav";

export default async function RoleLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "supervisor") redirect("/");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b bg-[#1E3A5F] px-4 py-3 text-white">
        <div className="font-semibold">현장기록 자동영상화 · 공감소장</div>
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
      <BottomNav home="/supervisor" />
    </div>
  );
}
