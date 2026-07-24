import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { constructionSites, siteStructures, constructionRecords, recordAssets, siteParticipants, structureTypes } from "@/lib/db/schema";
import { getMyOrgId } from "@/lib/org";
import { uploadToDrive } from "@/lib/drive";

export const runtime = "nodejs";

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

async function ownsSite(userId: string, siteId: string, role?: string) {
  const rows = await db.select().from(constructionSites).where(eq(constructionSites.id, siteId)).limit(1);
  const site = rows[0];
  if (!site) return false;
  // 발주처(농어촌공사) 및 관리자는 모든 현장 접근 가능
  if (role === "client" || role === "admin") return true;
  const orgId = await getMyOrgId(userId);
  if (site.createdBy === userId || (!!orgId && (site.contractorOrgId === orgId || site.clientOrgId === orgId))) {
    return true;
  }
  // 참여자로 초대된 경우 허용
  const _part = await db
    .select({ id: siteParticipants.id })
    .from(siteParticipants)
    .where(and(eq(siteParticipants.siteId, siteId), eq(siteParticipants.userId, userId)))
    .limit(1);
  return !!_part[0];
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client" && role !== "admin")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const userId = session.user.id;

    const fd = await req.formData();
    const siteStructureId = String(fd.get("siteStructureId") || "");
    const subTypeId = String(fd.get("subTypeId") || "");
    const phaseTemplateId = String(fd.get("phaseTemplateId") || "");
    const inspectionDate = String(fd.get("inspectionDate") || "") || todayStr();
    const _at = String(fd.get("assetType") || "photo");
    const assetType = _at === "video" ? "video" : _at === "map" ? "map" : "photo";
    const file = fd.get("file");
    if (!siteStructureId || !subTypeId || !phaseTemplateId || !(file instanceof File)) {
      return NextResponse.json({ error: "파일/구조물/세부항목/단계 정보가 필요합니다." }, { status: 400 });
    }

    const ssRows = await db.select().from(siteStructures).where(eq(siteStructures.id, siteStructureId)).limit(1);
    const ss = ssRows[0];
    if (!ss) return NextResponse.json({ error: "구조물을 찾을 수 없습니다." }, { status: 404 });
    if (!(await ownsSite(userId, ss.siteId, role))) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const existing = await db
      .select({ id: constructionRecords.id })
      .from(constructionRecords)
      .where(
        and(
          eq(constructionRecords.siteStructureId, siteStructureId),
          eq(constructionRecords.subTypeId, subTypeId),
          eq(constructionRecords.phaseTemplateId, phaseTemplateId),
          eq(constructionRecords.inspectionDate, inspectionDate)
        )
      )
      .limit(1);
    let recordId: string;
    if (existing[0]) {
      recordId = existing[0].id;
    } else {
      const [r] = await db
        .insert(constructionRecords)
        .values({
          siteId: ss.siteId,
          siteStructureId,
          subTypeId,
          phaseTemplateId,
          inspectionDate,
          status: "draft",
          recordedAt: new Date(),
          createdBy: userId,
        })
        .returning();
      recordId = r.id;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || (assetType === "video" ? "video/mp4" : "image/jpeg");
    const cleanName = (file.name || "upload").replace(/[\\/]/g, "_");
    const driveName = `${Date.now()}_${cleanName}`;
    // 폴더 구조: 현장(사업명_지구명) > 구조물명 > 검측일자
    const siteForFolder = await db
      .select({ projectName: constructionSites.projectName, districtName: constructionSites.districtName })
      .from(constructionSites)
      .where(eq(constructionSites.id, ss.siteId))
      .limit(1);
    const sf = siteForFolder[0];
    const siteFolder = sf ? `${sf.projectName}_${sf.districtName}` : ss.siteId;
    // 세부공종(공종) 하위 폴더까지 분리 - 같은 날 여러 공종이 섞이지 않게
    let subFolder = "";
    if (subTypeId) {
      const stRows = await db
        .select({ name: structureTypes.name })
        .from(structureTypes)
        .where(eq(structureTypes.id, subTypeId))
        .limit(1);
      subFolder = stRows[0]?.name || "";
    }
    const folderPath = [siteFolder, ss.name || siteStructureId, inspectionDate];
    if (subFolder) folderPath.push(subFolder);
    const up = await uploadToDrive({ name: driveName, mimeType, buffer, folderPath });

    const [asset] = await db
      .insert(recordAssets)
      .values({
        recordId,
        assetType,
        fileName: cleanName,
        fileUrl: up.webViewLink,
        mimeType,
        fileSizeBytes: buffer.length,
        uploadStatus: "uploaded",
        storageProvider: "google_drive",
        storageFileId: up.id,
        createdBy: userId,
      })
      .returning();

    return NextResponse.json({ ok: true, id: asset.id });
  } catch (e) {
    console.error("[assets:post]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "업로드 오류: " + msg }, { status: 500 });
  }
}
