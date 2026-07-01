import { NextResponse } from "next/server";
import { and, eq, asc, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { structureTypes, phaseTemplates, guideAssets, guideEntries } from "@/lib/db/schema";
import { uploadToDrive, deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

function inArraySafe(col: Parameters<typeof inArray>[0], vals: string[]) {
  return inArray(col, vals.length > 0 ? vals : ["00000000-0000-0000-0000-000000000000"]);
}

// F1~F5 단계 정의는 부모(대분류) phaseTemplates 에서 가져온다
async function getPhaseDefs(parentStructureTypeId: string) {
  return db
    .select({
      id: phaseTemplates.id,
      code: phaseTemplates.code,
      name: phaseTemplates.name,
      guideText: phaseTemplates.guideText,
      sortOrder: phaseTemplates.sortOrder,
    })
    .from(phaseTemplates)
    .where(and(eq(phaseTemplates.structureTypeId, parentStructureTypeId), eq(phaseTemplates.isActive, true)))
    .orderBy(asc(phaseTemplates.sortOrder));
}

export async function GET(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const structureTypeId = searchParams.get("structureTypeId");
  const parentId = searchParams.get("parentId");
  const subTypeId = searchParams.get("subTypeId");

  // (C) 세부항목의 F1~F5 가이드 + 자료
  if (subTypeId) {
    const subRows = await db
      .select({ id: structureTypes.id, name: structureTypes.name, parentId: structureTypes.parentId })
      .from(structureTypes)
      .where(eq(structureTypes.id, subTypeId))
      .limit(1);
    const sub = subRows[0];
    if (!sub) return NextResponse.json({ error: "세부항목을 찾을 수 없습니다." }, { status: 404 });

    // 단계 정의: 부모의 phaseTemplates (없으면 자기 자신 것)
    const defs = sub.parentId ? await getPhaseDefs(sub.parentId) : await getPhaseDefs(sub.id);

    // 세부항목별 guide_entries
    const entries = await db
      .select({ phaseCode: guideEntries.phaseCode, guideText: guideEntries.guideText })
      .from(guideEntries)
      .where(eq(guideEntries.subTypeId, subTypeId));
    const entryMap: Record<string, string> = {};
    entries.forEach((e) => (entryMap[e.phaseCode] = e.guideText || ""));

    const phases = defs.map((d) => ({
      code: d.code,
      name: d.name,
      sortOrder: d.sortOrder,
      parentGuideText: d.guideText || "",
      subGuideText: entryMap[d.code] || "",
    }));

    // 세부항목 자료
    const assets = await db
      .select({
        id: guideAssets.id,
        phaseCode: guideAssets.phaseCode,
        assetKind: guideAssets.assetKind,
        fileName: guideAssets.fileName,
        mimeType: guideAssets.mimeType,
      })
      .from(guideAssets)
      .where(eq(guideAssets.subTypeId, subTypeId))
      .orderBy(asc(guideAssets.createdAt));

    return NextResponse.json({ ok: true, sub: { id: sub.id, name: sub.name }, phases, assets });
  }

  // (B) 대분류의 세부항목(자식) 목록
  if (parentId) {
    const children = await db
      .select({ id: structureTypes.id, name: structureTypes.name, sortOrder: structureTypes.sortOrder })
      .from(structureTypes)
      .where(and(eq(structureTypes.parentId, parentId), eq(structureTypes.isActive, true)))
      .orderBy(asc(structureTypes.sortOrder));
    return NextResponse.json({ ok: true, children });
  }

  // (A-legacy) 대분류 자체의 F1~F5 (대분류 공통 가이드)
  if (structureTypeId) {
    const phases = await getPhaseDefs(structureTypeId);
    const phaseIds = phases.map((p) => p.id);
    let assets: {
      id: string;
      phaseTemplateId: string | null;
      assetKind: "reference" | "spec";
      fileName: string;
      mimeType: string;
    }[] = [];
    if (phaseIds.length > 0) {
      assets = await db
        .select({
          id: guideAssets.id,
          phaseTemplateId: guideAssets.phaseTemplateId,
          assetKind: guideAssets.assetKind,
          fileName: guideAssets.fileName,
          mimeType: guideAssets.mimeType,
        })
        .from(guideAssets)
        .where(inArraySafe(guideAssets.phaseTemplateId, phaseIds))
        .orderBy(asc(guideAssets.createdAt));
    }
    return NextResponse.json({ ok: true, phases, assets });
  }

  // (기본) 단계가 있는 대분류 목록 + 각 대분류의 세부항목 유무
  const all = await db
    .select({
      id: structureTypes.id,
      name: structureTypes.name,
      code: structureTypes.code,
      parentId: structureTypes.parentId,
      sortOrder: structureTypes.sortOrder,
    })
    .from(structureTypes)
    .where(eq(structureTypes.isActive, true))
    .orderBy(asc(structureTypes.sortOrder));

  const withPhases = await db
    .select({ sid: phaseTemplates.structureTypeId })
    .from(phaseTemplates)
    .where(eq(phaseTemplates.isActive, true));
  const sidSet = new Set(withPhases.map((r) => r.sid));

  const structures = all.filter((s) => sidSet.has(s.id) && !s.parentId);
  return NextResponse.json({ ok: true, structures });
}

// PATCH: 
//  대분류: { phaseTemplateId, guideText }
//  세부항목: { subTypeId, phaseCode, guideText }  -> guide_entries upsert
export async function PATCH(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const body = await req.json();
    const guideText = String(body.guideText ?? "").slice(0, 8000);

    if (body.subTypeId && body.phaseCode) {
      const subTypeId = String(body.subTypeId);
      const phaseCode = String(body.phaseCode);
      const existing = await db
        .select({ id: guideEntries.id })
        .from(guideEntries)
        .where(and(eq(guideEntries.subTypeId, subTypeId), eq(guideEntries.phaseCode, phaseCode)))
        .limit(1);
      if (existing[0]) {
        await db
          .update(guideEntries)
          .set({ guideText: guideText || null, updatedAt: new Date() })
          .where(eq(guideEntries.id, existing[0].id));
      } else {
        await db.insert(guideEntries).values({ subTypeId, phaseCode, guideText: guideText || null });
      }
      return NextResponse.json({ ok: true });
    }

    const phaseTemplateId = String(body.phaseTemplateId || "");
    if (!phaseTemplateId) return NextResponse.json({ error: "단계 ID가 필요합니다." }, { status: 400 });
    await db
      .update(phaseTemplates)
      .set({ guideText: guideText || null, updatedAt: new Date() })
      .where(eq(phaseTemplates.id, phaseTemplateId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "저장 오류: " + msg }, { status: 500 });
  }
}

// POST: 자료 업로드
//  대분류: phaseTemplateId
//  세부항목: subTypeId + phaseCode
export async function POST(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const fd = await req.formData();
    const assetKind = String(fd.get("assetKind") || "reference") === "spec" ? "spec" : "reference";
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const cleanName = (file.name || "upload").replace(/[\\/]/g, "_");
    const driveName = `${Date.now()}_${cleanName}`;
    const kindFolder = assetKind === "spec" ? "시방서" : "참고사진";

    const subTypeId = String(fd.get("subTypeId") || "");
    const phaseCode = String(fd.get("phaseCode") || "");

    if (subTypeId && phaseCode) {
      const subRows = await db
        .select({ name: structureTypes.name })
        .from(structureTypes)
        .where(eq(structureTypes.id, subTypeId))
        .limit(1);
      const subName = subRows[0]?.name || "세부항목";
      const folderPath = ["_검측가이드", subName, phaseCode, kindFolder];
      const up = await uploadToDrive({ name: driveName, mimeType, buffer, folderPath });
      const [row] = await db
        .insert(guideAssets)
        .values({
          subTypeId,
          phaseCode,
          assetKind,
          fileName: cleanName,
          mimeType,
          fileSizeBytes: buffer.length,
          storageProvider: "google_drive",
          storageFileId: up.id,
          createdBy: uid,
        })
        .returning();
      return NextResponse.json({ ok: true, id: row.id });
    }

    // 대분류(phaseTemplateId) 방식
    const phaseTemplateId = String(fd.get("phaseTemplateId") || "");
    if (!phaseTemplateId) return NextResponse.json({ error: "대상 정보가 필요합니다." }, { status: 400 });
    const ptRows = await db
      .select({ name: phaseTemplates.name, structureTypeId: phaseTemplates.structureTypeId })
      .from(phaseTemplates)
      .where(eq(phaseTemplates.id, phaseTemplateId))
      .limit(1);
    const pt = ptRows[0];
    if (!pt) return NextResponse.json({ error: "단계를 찾을 수 없습니다." }, { status: 404 });
    const stRows = await db
      .select({ name: structureTypes.name })
      .from(structureTypes)
      .where(eq(structureTypes.id, pt.structureTypeId))
      .limit(1);
    const structName = stRows[0]?.name || "구조물";
    const folderPath = ["_검측가이드", structName, pt.name || "단계", kindFolder];
    const up = await uploadToDrive({ name: driveName, mimeType, buffer, folderPath });
    const [row] = await db
      .insert(guideAssets)
      .values({
        phaseTemplateId,
        assetKind,
        fileName: cleanName,
        mimeType,
        fileSizeBytes: buffer.length,
        storageProvider: "google_drive",
        storageFileId: up.id,
        createdBy: uid,
      })
      .returning();
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    console.error("[guides:post]", e);
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "업로드 오류: " + msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");
    if (!assetId) return NextResponse.json({ error: "자료 ID가 필요합니다." }, { status: 400 });
    const rows = await db.select().from(guideAssets).where(eq(guideAssets.id, assetId)).limit(1);
    const a = rows[0];
    if (!a) return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
    if (a.storageFileId) {
      try {
        await deleteFromDrive(a.storageFileId);
      } catch {
        // 무시
      }
    }
    await db.delete(guideAssets).where(eq(guideAssets.id, assetId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "삭제 오류: " + msg }, { status: 500 });
  }
}
