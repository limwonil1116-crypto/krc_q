import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  inspectionRequests,
  siteStructures,
  constructionSites,
} from "@/lib/db/schema";
import { getMyBranch, isHeadOffice } from "@/lib/perm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  submitted: "신규 제출",
  under_review: "검토중",
  revision_requested: "재검측 요청",
  approved: "승인 완료",
};
const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-[#FE5000] text-white",
  under_review: "bg-amber-500 text-white",
  revision_requested: "bg-red-600 text-white",
  approved: "bg-emerald-600 text-white",
};

export default async function ClientInspectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const role = session.user.role;
  if (role !== "client" && role !== "admin") redirect("/");

  const branch = await getMyBranch(userId);
  const headOffice = isHeadOffice(branch);

  // 본부/관리자: 전체 / 지사: 해당 지사(executor) 현장만
  const statusFilter = inArray(inspectionRequests.status, [
    "submitted",
    "under_review",
    "revision_requested",
    "approved",
  ]);
  const whereCond =
    headOffice || role === "admin"
      ? statusFilter
      : branch
      ? and(statusFilter, eq(constructionSites.executor, branch))
      : statusFilter;

  const rows = await db
    .select({
      id: inspectionRequests.id,
      inspectionDate: inspectionRequests.inspectionDate,
      inspectionMatter: inspectionRequests.inspectionMatter,
      inspectionPart: inspectionRequests.inspectionPart,
      status: inspectionRequests.status,
      isRecheck: inspectionRequests.isRecheck,
      updatedAt: inspectionRequests.updatedAt,
      structureName: siteStructures.name,
      projectName: constructionSites.projectName,
      executor: constructionSites.executor,
    })
    .from(inspectionRequests)
    .innerJoin(siteStructures, eq(inspectionRequests.siteStructureId, siteStructures.id))
    .innerJoin(constructionSites, eq(inspectionRequests.siteId, constructionSites.id))
    .where(whereCond)
    .orderBy(desc(inspectionRequests.updatedAt));

  const pending = rows.filter((r) => r.status !== "approved");
  const done = rows.filter((r) => r.status === "approved");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">검측 요청 관리</h1>
        <p className="text-sm text-neutral-500">
          {headOffice || role === "admin" ? "전체 현장의 검측 요청" : `${branch || "담당"} 지사 검측 요청`}을 확인하고 결과를 통보하세요.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-[#FE5000]">{rows.filter((r) => r.status === "submitted").length}</div>
          <div className="text-xs text-neutral-500">신규 제출</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-amber-500">{rows.filter((r) => r.status === "under_review").length}</div>
          <div className="text-xs text-neutral-500">검토중</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{done.length}</div>
          <div className="text-xs text-neutral-500">승인 완료</div>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          대기중인 검측 요청이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <Link
              key={r.id}
              href={`/client/inspections/${r.id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-3 hover:border-[#0033A0]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {r.projectName}
                  {r.executor ? ` · ${r.executor}` : ""}
                </span>
                <span className={"rounded px-1.5 py-0.5 text-xs font-semibold " + (STATUS_COLOR[r.status] || "bg-neutral-400 text-white")}>
                  {r.isRecheck ? "(재) " : ""}
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
              <div className="mt-1 font-semibold text-neutral-800">
                {r.structureName} · {r.inspectionMatter || "(검측사항 없음)"}
              </div>
              <div className="mt-0.5 text-sm text-neutral-500">
                {r.inspectionDate} {r.inspectionPart ? `· ${r.inspectionPart}` : ""}
              </div>
            </Link>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <p className="mb-2 mt-4 text-xs font-semibold text-neutral-500">승인 완료</p>
          <div className="space-y-2">
            {done.map((r) => (
              <Link
                key={r.id}
                href={`/client/inspections/${r.id}`}
                className="block rounded-xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">
                    {r.structureName} · {r.inspectionMatter || ""}
                  </span>
                  <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white">승인</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">{r.inspectionDate}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
