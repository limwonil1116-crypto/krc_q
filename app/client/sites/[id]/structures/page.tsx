import { alias } from "drizzle-orm/pg-core";
import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, structureTypes, siteStructures } from "@/lib/db/schema";
import { StructureManager } from "@/components/site/structure-manager";

export const dynamic = "force-dynamic";

export default async function StructuresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const siteRows = await db.select().from(constructionSites).where(eq(constructionSites.id, id)).limit(1);
  const site = siteRows[0];
  if (!site) notFound();

  const categories = await db
    .select({ id: structureTypes.id, code: structureTypes.code, name: structureTypes.name })
    .from(structureTypes)
    .where(and(isNull(structureTypes.parentId), eq(structureTypes.isActive, true)))
    .orderBy(structureTypes.sortOrder);

  const parentType = alias(structureTypes, "parent_type");
  const structures = await db
    .select({
      id: siteStructures.id,
      name: siteStructures.name,
      structureTypeId: siteStructures.structureTypeId,
      locationDescription: siteStructures.locationDescription,
      status: siteStructures.status,
      typeName: structureTypes.name,
      parentName: parentType.name,
    })
    .from(siteStructures)
    .innerJoin(structureTypes, eq(siteStructures.structureTypeId, structureTypes.id))
    .leftJoin(parentType, eq(structureTypes.parentId, parentType.id))
    .where(eq(siteStructures.siteId, id))
    .orderBy(siteStructures.createdAt);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-neutral-500">
          {site.districtName} · {site.projectName}
        </div>
        <a
          href={`/api/sites/${site.id}/download`}
          className="whitespace-nowrap rounded-md border border-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] hover:bg-[#EEF3F9]"
        >
          ⬇ 현장 전체 다운로드(ZIP)
        </a>
      </div>
      <StructureManager
        siteId={site.id}
        structureBase={`/client/sites/${site.id}/structures`}
        categories={categories}
        structures={structures}
      />
    </div>
  );
}
