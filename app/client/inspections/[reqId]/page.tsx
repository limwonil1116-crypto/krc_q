import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  inspectionRequests,
  checklists,
  checklistItems,
  siteStructures,
  constructionSites,
} from "@/lib/db/schema";
import { getMyBranch, isHeadOffice } from "@/lib/perm";
import { SupervisorReview } from "@/components/inspection/supervisor-review";

export const dynamic = "force-dynamic";

export default async function ClientInspectionDetail({
  params,
}: {
  params: Promise<{ reqId: string }>;
}) {
  const { reqId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "client" && role !== "admin") redirect("/");

  const reqRows = await db
    .select({
      id: inspectionRequests.id,
      siteId: inspectionRequests.siteId,
      siteStructureId: inspectionRequests.siteStructureId,
      inspectionDate: inspectionRequests.inspectionDate,
      requestNo: inspectionRequests.requestNo,
      locationWork: inspectionRequests.locationWork,
      inspectionPart: inspectionRequests.inspectionPart,
      inspectionMatter: inspectionRequests.inspectionMatter,
      isRecheck: inspectionRequests.isRecheck,
      contractorAgentName: inspectionRequests.contractorAgentName,
      contractorCheckerName: inspectionRequests.contractorCheckerName,
      contractorSignedAt: inspectionRequests.contractorSignedAt,
      supervisorId: inspectionRequests.supervisorId,
      inspectionResult: inspectionRequests.inspectionResult,
      instruction: inspectionRequests.instruction,
      supervisorSignature: inspectionRequests.supervisorSignature,
      status: inspectionRequests.status,
    })
    .from(inspectionRequests)
    .where(eq(inspectionRequests.id, reqId))
    .limit(1);
  const ir = reqRows[0];
  if (!ir) notFound();

  const siteRows = await db
    .select({
      projectName: constructionSites.projectName,
      districtName: constructionSites.districtName,
      executor: constructionSites.executor,
    })
    .from(constructionSites)
    .where(eq(constructionSites.id, ir.siteId))
    .limit(1);
  const site = siteRows[0];

  // 권한: 본부/관리자는 전체, 지사는 해당 지사(executor)만
  const branch = await getMyBranch(session.user.id);
  const headOffice = isHeadOffice(branch);
  if (role !== "admin" && !headOffice) {
    if (branch && site?.executor && site.executor !== branch) {
      redirect("/client/inspections");
    }
  }

  const ssRows = await db
    .select({ name: siteStructures.name })
    .from(siteStructures)
    .where(eq(siteStructures.id, ir.siteStructureId))
    .limit(1);

  const cls = await db
    .select()
    .from(checklists)
    .where(eq(checklists.inspectionRequestId, reqId))
    .orderBy(asc(checklists.sortOrder));

  const clWithItems = [];
  for (const cl of cls) {
    const its = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.checklistId, cl.id))
      .orderBy(asc(checklistItems.sortOrder));
    clWithItems.push({
      id: cl.id,
      facilityName: cl.facilityName,
      workName: cl.workName,
      items: its.map((it) => ({
        id: it.id,
        itemNo: it.itemNo,
        checkItem: it.checkItem,
        standard: it.standard,
        contractorResult: it.contractorResult,
        contractorNote: it.contractorNote,
        supervisorResult: it.supervisorResult,
        supervisorNote: it.supervisorNote,
      })),
    });
  }

  return (
    <SupervisorReview
      request={{
        ...ir,
        structureName: ssRows[0]?.name ?? "",
        projectName: site?.projectName ?? "",
        districtName: site?.districtName ?? "",
      }}
      checklists={clWithItems}
      backHref="/client/inspections"
    />
  );
}
