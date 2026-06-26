import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { getMyBranch, isHeadOffice } from "@/lib/perm";
import { ActionButton } from "@/components/kit/buttons";
import { SitesTable } from "@/components/site/sites-table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;
  const orgId = userId ? await getMyOrgId(userId) : null;
  const branch = userId ? await getMyBranch(userId) : null;
  const headOffice = isHeadOffice(branch);
  // 본부내근: 전체 / 특정 지사: executor === 지사 / 지사정보 없으면 기존 org 기준
  const whereCond = headOffice
    ? undefined
    : branch
    ? eq(constructionSites.executor, branch)
    : orgId
    ? eq(constructionSites.clientOrgId, orgId)
    : undefined;
  const raw =
    headOffice || whereCond
      ? await (whereCond
          ? db.select().from(constructionSites).where(whereCond).orderBy(desc(constructionSites.createdAt))
          : db.select().from(constructionSites).orderBy(desc(constructionSites.createdAt)))
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
    startedOn: s.startedOn ?? null,
    endedOn: s.endedOn ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0033A0]">건설현장 현황</h1>
        <Link href="/client/sites/new">
          <ActionButton>+ 현장 등록</ActionButton>
        </Link>
      </div>
      <SitesTable sites={sites} basePath="/client/sites" />
    </div>
  );
}
