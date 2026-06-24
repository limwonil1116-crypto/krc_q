import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { ActionButton } from "@/components/kit/buttons";
import { SitesTable } from "@/components/site/sites-table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;
  const orgId = userId ? await getMyOrgId(userId) : null;
  const raw = orgId
    ? await db
        .select()
        .from(constructionSites)
        .where(eq(constructionSites.contractorOrgId, orgId))
        .orderBy(desc(constructionSites.createdAt))
    : [];
  const sites = raw.map((s) => ({
    id: s.id,
    districtName: s.districtName,
    projectName: s.projectName,
    executor: s.executor,
    workType: s.workType,
    address: s.address,
    status: s.status,
    supervisorName: s.supervisorName,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0033A0]">시공사 현장</h1>
        <Link href="/contractor/sites/new">
          <ActionButton>+ 현장 등록</ActionButton>
        </Link>
      </div>
      <SitesTable sites={sites} basePath="/contractor/sites" />
    </div>
  );
}
