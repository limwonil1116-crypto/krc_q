import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status === "active") redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <OnboardingForm defaultName={session.user.name ?? ""} />
    </div>
  );
}
