import { PassThrough, Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  constructionSites,
  siteStructures,
  phaseTemplates,
  constructionRecords,
  recordAssets,
} from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { getDriveStream } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function makeZip() {
  // archiver 8.x : 팩토리 함수 없음, ZipArchive 클래스 사용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("archiver");
  const ZipArchive = mod.ZipArchive ?? mod.default?.ZipArchive;
  if (typeof ZipArchive !== "function") {
    throw new Error("ZipArchive not found. keys=" + Object.keys(mod || {}).join(","));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ZipArchive({ zlib: { level: 5 } }) as any;
}

function san(s: string | null | undefined) {
  return (s || "").replace(/[\\/:*?"<>|]/g, "_").trim() || "_";
}

async function ownsSite(userId: string, siteId: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return false;
  const orgId = await getMyOrgId(userId);
  return site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  if (!(await ownsSite(session.user.id, id))) return new Response("Forbidden", { status: 403 });

  const siteRows = await db
    .select({ districtName: constructionSites.districtName, projectName: constructionSites.projectName })
    .from(constructionSites)
    .where(eq(constructionSites.id, id))
    .limit(1);
  const site = siteRows[0];
  if (!site) return new Response("Not found", { status: 404 });

  const rows = await db
    .select({
      storageFileId: recordAssets.storageFileId,
      fileName: recordAssets.fileName,
      structureName: siteStructures.name,
      inspectionDate: constructionRecords.inspectionDate,
      phaseName: phaseTemplates.name,
    })
    .from(recordAssets)
    .innerJoin(constructionRecords, eq(recordAssets.recordId, constructionRecords.id))
    .innerJoin(siteStructures, eq(constructionRecords.siteStructureId, siteStructures.id))
    .innerJoin(phaseTemplates, eq(constructionRecords.phaseTemplateId, phaseTemplates.id))
    .where(and(eq(constructionRecords.siteId, id), eq(recordAssets.uploadStatus, "uploaded")));

  if (rows.length === 0) return new Response("등록된 파일이 없습니다.", { status: 404 });

  const archive = await makeZip();
  const pass = new PassThrough();
  archive.on("error", (e: unknown) => {
    console.error("[site:download] archive", e);
    pass.destroy(e instanceof Error ? e : new Error(String(e)));
  });
  archive.pipe(pass);

  (async () => {
    try {
      let i = 0;
      for (const r of rows) {
        i += 1;
        if (!r.storageFileId) continue;
        const s = await getDriveStream(r.storageFileId);
        const p = `${san(r.structureName)}/${san(r.inspectionDate) || "날짜미상"}/${san(r.phaseName)}/${String(i).padStart(3, "0")}_${san(r.fileName)}`;
        archive.append(s, { name: p });
      }
      await archive.finalize();
    } catch (e) {
      console.error("[site:download]", e);
      archive.abort();
    }
  })();

  const name = `${san(site.districtName)}_${san(site.projectName)}_전체`;
  return new Response(Readable.toWeb(pass) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="site.zip"; filename*=UTF-8''${encodeURIComponent(name)}.zip`,
    },
  });
}
