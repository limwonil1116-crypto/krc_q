import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  constructionSites,
  structureTypes,
  siteStructures,
  phaseTemplates,
  constructionRecords,
  recordAssets,
} from "@/lib/db/schema";
import { VideoComposer } from "@/components/record/video-composer";

export const dynamic = "force-dynamic";

export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; structureId: string }>;
  searchParams: Promise<{ date?: string; autosave?: string }>;
}) {
  const { id, structureId } = await params;
  const sp = await searchParams;
  const initialDate = sp.date || "";
  const autosaveFlag = sp.autosave === "1";
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
      workType: constructionSites.workType,
      executor: constructionSites.executor,
      contractorCompany: constructionSites.contractorCompany,
      contractorLogoDriveId: constructionSites.contractorLogoDriveId,
    })
    .from(constructionSites)
    .where(eq(constructionSites.id, id))
    .limit(1);
  const site = siteRows[0];

  const phases = await db
    .select({
      id: phaseTemplates.id,
      code: phaseTemplates.code,
      name: phaseTemplates.name,
      sortOrder: phaseTemplates.sortOrder,
    })
    .from(phaseTemplates)
    .where(and(eq(phaseTemplates.structureTypeId, ss.structureTypeId), eq(phaseTemplates.isActive, true)))
    .orderBy(asc(phaseTemplates.sortOrder));

  const records = await db
    .select({
      phaseTemplateId: constructionRecords.phaseTemplateId,
      inspectionDate: constructionRecords.inspectionDate,
      title: constructionRecords.title,
      textDescription: constructionRecords.textDescription,
      status: constructionRecords.status,
      latitude: constructionRecords.latitude,
      longitude: constructionRecords.longitude,
      locationAddress: constructionRecords.locationAddress,
    })
    .from(constructionRecords)
    .where(eq(constructionRecords.siteStructureId, structureId));

  const submittedDates = Array.from(
    new Set(
      records
        .filter((r) => r.status === "submitted" && r.inspectionDate)
        .map((r) => r.inspectionDate as string)
    )
  );

  const assets = await db
    .select({
      id: recordAssets.id,
      phaseTemplateId: constructionRecords.phaseTemplateId,
      inspectionDate: constructionRecords.inspectionDate,
      assetType: recordAssets.assetType,
      fileName: recordAssets.fileName,
      mimeType: recordAssets.mimeType,
    })
    .from(recordAssets)
    .innerJoin(constructionRecords, eq(recordAssets.recordId, constructionRecords.id))
    .where(and(eq(constructionRecords.siteStructureId, structureId), eq(recordAssets.uploadStatus, "uploaded")));

  const dset = new Set<string>();
  records.forEach((r) => r.inspectionDate && dset.add(r.inspectionDate));
  assets.forEach((a) => a.inspectionDate && dset.add(a.inspectionDate));
  const dates = Array.from(dset).sort((a, b) => b.localeCompare(a));

  const meta = {
    projectName: site?.projectName ?? "",
    districtName: site?.districtName ?? "",
    address: site?.address ?? "",
    workType: site?.workType ?? null,
    executor: site?.executor ?? null,
    structureName: ss.name,
    typeName: ss.typeName,
    contractorCompany: site?.contractorCompany ?? null,
    hasLogo: !!site?.contractorLogoDriveId,
    siteId: id,
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <a
          href={`/api/structures/${ss.id}/download`}
          className="whitespace-nowrap rounded-md border border-[#0033A0] px-3 py-1.5 text-xs font-semibold text-[#0033A0] hover:bg-[#EAF0FB]"
        >
          ⬇ 이 구조물 전체 다운로드(ZIP)
        </a>
      </div>
      <VideoComposer meta={meta} phases={phases} records={records} assets={assets} dates={dates} siteStructureId={ss.id} submittedDates={submittedDates} initialDate={initialDate} autosaveOnLoad={autosaveFlag} />
    </div>
  );
}
