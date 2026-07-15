import { and, asc, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  structureTypes,
  siteStructures,
  constructionSites,
  constructionRecords,
  recordAssets,
  siteParticipants,
  users,
  inspectionRequests,
} from "@/lib/db/schema";
import { InspectionForm } from "@/components/inspection/inspection-form";

export const dynamic = "force-dynamic";

export default async function InspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; structureId: string }>;
  searchParams: Promise<{ date?: string; reqId?: string; sub?: string; auto?: string }>;
}) {
  const { id, structureId } = await params;
  const { date, reqId, sub, auto } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ssRows = await db
    .select({
      id: siteStructures.id,
      name: siteStructures.name,
      siteId: siteStructures.siteId,
      structureTypeId: siteStructures.structureTypeId,
      typeName: structureTypes.name,
    })
    .from(siteStructures)
    .innerJoin(structureTypes, eq(siteStructures.structureTypeId, structureTypes.id))
    .where(eq(siteStructures.id, structureId))
    .limit(1);
  const ss = ssRows[0];
  if (!ss || ss.siteId !== id) notFound();

  const siteRows = await db
    .select({
      projectName: constructionSites.projectName,
      districtName: constructionSites.districtName,
      address: constructionSites.address,
      contractorCompany: constructionSites.contractorCompany,
    })
    .from(constructionSites)
    .where(eq(constructionSites.id, id))
    .limit(1);
  const site = siteRows[0];

  // 세부공종
  const subTypes = await db
    .select({ id: structureTypes.id, name: structureTypes.name })
    .from(structureTypes)
    .where(and(eq(structureTypes.parentId, ss.structureTypeId), eq(structureTypes.isActive, true)))
    .orderBy(structureTypes.sortOrder);

  // 같은 현장의 공사감독원 목록
  const supervisors = await db
    .select({ id: users.id, name: users.name, branch: users.branch })
    .from(siteParticipants)
    .innerJoin(users, eq(siteParticipants.userId, users.id))
    .where(and(eq(siteParticipants.siteId, id), eq(siteParticipants.participantRole, "supervisor")));

  // 기존 검측기록 (위치·부위·검측내용 자동연계용)
  const recs = await db
    .select({
      phaseTemplateId: constructionRecords.phaseTemplateId,
      subTypeId: constructionRecords.subTypeId,
      inspectionDate: constructionRecords.inspectionDate,
      inspectionContent: constructionRecords.inspectionContent,
      inspectionPartFromMain: constructionRecords.inspectionPartFromMain,
      inspectionPartFromSub: constructionRecords.inspectionPartFromSub,
      inspectionPartToMain: constructionRecords.inspectionPartToMain,
      inspectionPartToSub: constructionRecords.inspectionPartToSub,
      locationAddress: constructionRecords.locationAddress,
    })
    .from(constructionRecords)
    .where(eq(constructionRecords.siteStructureId, structureId));

  // 자료(사진/영상/도면/지도) 개수 확인용
  const assets = await db
    .select({
      inspectionDate: constructionRecords.inspectionDate,
      subTypeId: constructionRecords.subTypeId,
      assetType: recordAssets.assetType,
    })
    .from(recordAssets)
    .innerJoin(constructionRecords, eq(recordAssets.recordId, constructionRecords.id))
    .where(and(eq(constructionRecords.siteStructureId, structureId), eq(recordAssets.uploadStatus, "uploaded")));

  // 기존 요청서 목록
  const existingRequests = await db
    .select({
      id: inspectionRequests.id,
      inspectionDate: inspectionRequests.inspectionDate,
      inspectionMatter: inspectionRequests.inspectionMatter,
      status: inspectionRequests.status,
    })
    .from(inspectionRequests)
    .where(eq(inspectionRequests.siteStructureId, structureId))
    .orderBy(desc(inspectionRequests.inspectionDate));

  return (
    <InspectionForm
      initialSubTypeId={sub || ""}
      autoFill={auto === "1"}
      siteId={id}
      siteStructureId={ss.id}
      structureName={ss.name}
      typeName={ss.typeName}
      site={site ?? null}
      subTypes={subTypes}
      supervisors={supervisors}
      records={recs}
      assets={assets}
      existingRequests={existingRequests}
      initialDate={date ?? ""}
      initialReqId={reqId ?? ""}
      backHref={`/contractor/sites/${id}/structures/${structureId}`}
    />
  );
}
