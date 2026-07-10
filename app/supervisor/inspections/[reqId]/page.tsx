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
  users,
} from "@/lib/db/schema";
import { SupervisorReview } from "@/components/inspection/supervisor-review";

export const dynamic = "force-dynamic";

export default async function SupervisorInspectionDetail({
  params,
}: {
  params: Promise<{ reqId: string }>;
}) {
  const { reqId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "supervisor" && role !== "admin") redirect("/");

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
  if (role !== "admin" && ir.supervisorId !== session.user.id) redirect("/supervisor/inspections");

  const ssRows = await db
    .select({ name: siteStructures.name })
    .from(siteStructures)
    .where(eq(siteStructures.id, ir.siteStructureId))
    .limit(1);
  const siteRows = await db
    .select({ projectName: constructionSites.projectName, districtName: constructionSites.districtName })
    .from(constructionSites)
    .where(eq(constructionSites.id, ir.siteId))
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
        projectName: siteRows[0]?.projectName ?? "",
        districtName: siteRows[0]?.districtName ?? "",
      }}
      checklists={clWithItems}
      backHref="/supervisor/inspections"
    />
  );
}
