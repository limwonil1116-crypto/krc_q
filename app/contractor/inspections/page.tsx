import Link from "next/link";
import { desc, eq, inArray, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, siteParticipants, inspectionRequests } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  submitted: "제출됨",
  under_review: "검토중",
  revision_requested: "보완요청",
  approved: "승인완료",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  submitted: "bg-[#EAF0FB] text-[#0033A0]",
  under_review: "bg-amber-100 text-amber-700",
  revision_requested: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
};

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;
  const orgId = userId ? await getMyOrgId(userId) : null;

  // 내 조직 현장 + 초대받은 현장
  const invitedRows = userId
    ? await db
        .select({ siteId: siteParticipants.siteId })
        .from(siteParticipants)
        .where(eq(siteParticipants.userId, userId))
    : [];
  const invitedIds = invitedRows.map((r) => r.siteId);
  const cond =
    orgId && invitedIds.length > 0
      ? or(eq(constructionSites.contractorOrgId, orgId), inArray(constructionSites.id, invitedIds))
      : orgId
      ? eq(constructionSites.contractorOrgId, orgId)
      : invitedIds.length > 0
      ? inArray(constructionSites.id, invitedIds)
      : null;
  const mySites = cond
    ? await db.select({ id: constructionSites.id }).from(constructionSites).where(cond)
    : [];
  const siteIds = mySites.map((s) => s.id);

  const rows = siteIds.length
    ? await db
        .select({
          id: inspectionRequests.id,
          siteId: inspectionRequests.siteId,
          structureId: inspectionRequests.siteStructureId,
          inspectionDate: inspectionRequests.inspectionDate,
          status: inspectionRequests.status,
          locationWork: inspectionRequests.locationWork,
          structureName: siteStructures.name,
          projectName: constructionSites.projectName,
          districtName: constructionSites.districtName,
        })
        .from(inspectionRequests)
        .innerJoin(siteStructures, eq(siteStructures.id, inspectionRequests.siteStructureId))
        .innerJoin(constructionSites, eq(constructionSites.id, inspectionRequests.siteId))
        .where(inArray(inspectionRequests.siteId, siteIds))
        .orderBy(desc(inspectionRequests.inspectionDate))
    : [];

  const nDraft = rows.filter((r) => r.status === "draft").length;
  const nOpen = rows.filter((r) => r.status === "submitted" || r.status === "under_review").length;
  const nDone = rows.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#0033A0]">검측 관리</h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <p className="text-xs text-neutral-500">작성중</p>
          <p className="text-lg font-bold text-neutral-700">{nDraft}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <p className="text-xs text-neutral-500">검토 대기·진행</p>
          <p className="text-lg font-bold text-[#0033A0]">{nOpen}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <p className="text-xs text-neutral-500">승인완료</p>
          <p className="text-lg font-bold text-green-700">{nDone}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
          검측 요청이 없습니다. 구조물 검측 기록 화면에서 [📋 검측요청서] 로 작성하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/contractor/sites/${r.siteId}/structures/${r.structureId}/inspection?reqId=${r.id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-3 hover:border-[#0033A0]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-800">
                    {r.structureName}
                    {r.locationWork ? <span className="text-neutral-400"> · {r.locationWork}</span> : null}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.districtName || r.projectName} · 검측일자 {r.inspectionDate || "-"}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 rounded px-2 py-0.5 text-xs font-semibold " +
                    (STATUS_CLASS[r.status || "draft"] || "bg-neutral-100 text-neutral-600")
                  }
                >
                  {STATUS_LABEL[r.status || "draft"] || r.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
