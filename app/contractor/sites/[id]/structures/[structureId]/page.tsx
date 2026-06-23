import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  structureTypes,
  siteStructures,
  phaseTemplates,
  constructionRecords,
  recordAssets,
} from "@/lib/db/schema";
import { PhaseRecorder } from "@/components/record/phase-recorder";

export const dynamic = "force-dynamic";

export default async function StructurePhasesPage({
  params,
}: {
  params: Promise<{ id: string; structureId: string }>;
}) {
  const { id, structureId } = await params;
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

  // 세부 항목 = 구조물 대분류의 자식
  const subTypes = await db
    .select({ id: structureTypes.id, name: structureTypes.name })
    .from(structureTypes)
    .where(and(eq(structureTypes.parentId, ss.structureTypeId), eq(structureTypes.isActive, true)))
    .orderBy(structureTypes.sortOrder);

  // 5단계 = 대분류에 부여됨
  const phases = await db
    .select({
      id: phaseTemplates.id,
      code: phaseTemplates.code,
      name: phaseTemplates.name,
      guideText: phaseTemplates.guideText,
      sortOrder: phaseTemplates.sortOrder,
      minPhotoCount: phaseTemplates.minPhotoCount,
      minVideoCount: phaseTemplates.minVideoCount,
      isRequired: phaseTemplates.isRequired,
    })
    .from(phaseTemplates)
    .where(and(eq(phaseTemplates.structureTypeId, ss.structureTypeId), eq(phaseTemplates.isActive, true)))
    .orderBy(asc(phaseTemplates.sortOrder));

  const recs = await db
    .select({
      id: constructionRecords.id,
      phaseTemplateId: constructionRecords.phaseTemplateId,
      subTypeId: constructionRecords.subTypeId,
      inspectionDate: constructionRecords.inspectionDate,
      title: constructionRecords.title,
      textDescription: constructionRecords.textDescription,
      voiceMemoText: constructionRecords.voiceMemoText,
      notApplicable: constructionRecords.notApplicable,
      notApplicableReason: constructionRecords.notApplicableReason,
      status: constructionRecords.status,
    })
    .from(constructionRecords)
    .where(eq(constructionRecords.siteStructureId, structureId));

  const assets = await db
    .select({
      id: recordAssets.id,
      phaseTemplateId: constructionRecords.phaseTemplateId,
      subTypeId: constructionRecords.subTypeId,
      inspectionDate: constructionRecords.inspectionDate,
      assetType: recordAssets.assetType,
      fileName: recordAssets.fileName,
      mimeType: recordAssets.mimeType,
    })
    .from(recordAssets)
    .innerJoin(constructionRecords, eq(recordAssets.recordId, constructionRecords.id))
    .where(and(eq(constructionRecords.siteStructureId, structureId), eq(recordAssets.uploadStatus, "uploaded")));

  return (
    <PhaseRecorder
      siteStructureId={ss.id}
      structureName={ss.name}
      typeName={ss.typeName}
      subTypes={subTypes}
      phases={phases}
      records={recs}
      assets={assets}
      videoHref={`/contractor/sites/${id}/structures/${structureId}/video`}
    />
  );
}
