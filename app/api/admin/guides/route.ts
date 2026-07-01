import { NextResponse } from "next/server";
import { and, eq, asc, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { structureTypes, phaseTemplates, guideAssets } from "@/lib/db/schema";
import { uploadToDrive, deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

// GET:
//  ?structureTypeId=x  -> 그 구조물의 F1~F5 단계 목록(guideText) + 단계별 자료
//  없으면              -> 구조물 목록 (단계가 있는 부모 구조물)
export async function GET(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const structureTypeId = searchParams.get("structureTypeId");

  if (structureTypeId) {
    const phases = await db
      .select({
        id: phaseTemplates.id,
        code: phaseTemplates.code,
        name: phaseTemplates.name,
        guideText: phaseTemplates.guideText,
        sortOrder: phaseTemplates.sortOrder,
      })
      .from(phaseTemplates)
      .where(and(eq(phaseTemplates.structureTypeId, structureTypeId), eq(phaseTemplates.isActive, true)))
      .orderBy(asc(phaseTemplates.sortOrder));

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
        .orderBy(asc(guideAssets.sortOrder), asc(guideAssets.createdAt));
    }
    return NextResponse.json({ ok: true, phases, assets });
  }

  // 단계(phaseTemplates)를 가진 구조물만 목록으로
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

  // 단계가 존재하는 structureTypeId 집합
  const withPhases = await db
    .select({ sid: phaseTemplates.structureTypeId })
    .from(phaseTemplates)
    .where(eq(phaseTemplates.isActive, true));
  const sidSet = new Set(withPhases.map((r) => r.sid));

  const structures = all.filter((s) => sidSet.has(s.id));
  return NextResponse.json({ ok: true, structures });
}

function inArraySafe(col: Parameters<typeof inArray>[0], vals: string[]) {
  return inArray(col, vals.length > 0 ? vals : ["00000000-0000-0000-0000-000000000000"]);
}

// PATCH: 단계 guideText 저장 { phaseTemplateId, guideText }
export async function PATCH(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const body = await req.json();
    const phaseTemplateId = String(body.phaseTemplateId || "");
    const guideText = String(body.guideText ?? "").slice(0, 8000);
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

// POST: 자료 업로드 fields: phaseTemplateId, assetKind(reference|spec), file
export async function POST(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const fd = await req.formData();
    const phaseTemplateId = String(fd.get("phaseTemplateId") || "");
    const assetKind = String(fd.get("assetKind") || "reference") === "spec" ? "spec" : "reference";
    const file = fd.get("file");
    if (!phaseTemplateId || !(file instanceof File)) {
      return NextResponse.json({ error: "단계/파일 정보가 필요합니다." }, { status: 400 });
    }

    const ptRows = await db
      .select({
        id: phaseTemplates.id,
        name: phaseTemplates.name,
        structureTypeId: phaseTemplates.structureTypeId,
      })
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const cleanName = (file.name || "upload").replace(/[\\/]/g, "_");
    const driveName = `${Date.now()}_${cleanName}`;
    const kindFolder = assetKind === "spec" ? "시방서" : "참고사진";
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

// DELETE: ?assetId=x
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
