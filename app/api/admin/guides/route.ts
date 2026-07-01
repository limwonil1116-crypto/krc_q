import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { structureTypes, guideAssets } from "@/lib/db/schema";
import { uploadToDrive, deleteFromDrive } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

// GET: ?structureTypeId=x 있으면 그 단계의 guideText + 자료목록
//      없으면 구조물 트리(부모+자식)
export async function GET(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const structureTypeId = searchParams.get("structureTypeId");

  if (structureTypeId) {
    const rows = await db
      .select({ id: structureTypes.id, name: structureTypes.name, guideText: structureTypes.guideText })
      .from(structureTypes)
      .where(eq(structureTypes.id, structureTypeId))
      .limit(1);
    if (!rows[0]) return NextResponse.json({ error: "단계를 찾을 수 없습니다." }, { status: 404 });

    const assets = await db
      .select({
        id: guideAssets.id,
        assetKind: guideAssets.assetKind,
        fileName: guideAssets.fileName,
        mimeType: guideAssets.mimeType,
        storageFileId: guideAssets.storageFileId,
      })
      .from(guideAssets)
      .where(eq(guideAssets.structureTypeId, structureTypeId))
      .orderBy(asc(guideAssets.sortOrder), asc(guideAssets.createdAt));

    return NextResponse.json({ ok: true, item: rows[0], assets });
  }

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

  const parents = all.filter((s) => !s.parentId);
  const tree = parents.map((p) => ({ ...p, children: all.filter((c) => c.parentId === p.id) }));
  const orphanChildren = all.filter((s) => s.parentId && !parents.some((p) => p.id === s.parentId));
  return NextResponse.json({ ok: true, tree, orphanChildren });
}

// PATCH: guideText 저장 { structureTypeId, guideText }
export async function PATCH(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const body = await req.json();
    const structureTypeId = String(body.structureTypeId || "");
    const guideText = String(body.guideText ?? "").slice(0, 8000);
    if (!structureTypeId) return NextResponse.json({ error: "단계 ID가 필요합니다." }, { status: 400 });
    await db
      .update(structureTypes)
      .set({ guideText: guideText || null, updatedAt: new Date() })
      .where(eq(structureTypes.id, structureTypeId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "저장 오류: " + msg }, { status: 500 });
  }
}

// POST: 자료 업로드 (multipart) fields: structureTypeId, assetKind(reference|spec), file
export async function POST(req: Request) {
  const uid = await requireAdmin();
  if (!uid) return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  try {
    const fd = await req.formData();
    const structureTypeId = String(fd.get("structureTypeId") || "");
    const assetKind = String(fd.get("assetKind") || "reference") === "spec" ? "spec" : "reference";
    const file = fd.get("file");
    if (!structureTypeId || !(file instanceof File)) {
      return NextResponse.json({ error: "단계/파일 정보가 필요합니다." }, { status: 400 });
    }

    const stRows = await db
      .select({ id: structureTypes.id, name: structureTypes.name })
      .from(structureTypes)
      .where(eq(structureTypes.id, structureTypeId))
      .limit(1);
    const st = stRows[0];
    if (!st) return NextResponse.json({ error: "단계를 찾을 수 없습니다." }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const cleanName = (file.name || "upload").replace(/[\\/]/g, "_");
    const driveName = `${Date.now()}_${cleanName}`;
    const kindFolder = assetKind === "spec" ? "시방서" : "참고사진";
    const folderPath = ["_검측가이드", st.name || structureTypeId, kindFolder];
    const up = await uploadToDrive({ name: driveName, mimeType, buffer, folderPath });

    const [row] = await db
      .insert(guideAssets)
      .values({
        structureTypeId,
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

// DELETE: ?assetId=x  자료 삭제(드라이브+DB)
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
        // 드라이브 삭제 실패해도 DB 는 지움
      }
    }
    await db.delete(guideAssets).where(eq(guideAssets.id, assetId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: "삭제 오류: " + msg }, { status: 500 });
  }
}
