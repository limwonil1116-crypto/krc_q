import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checklistPresets } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

type Row = { subTypeId: string; itemNo: number; checkItem: string; standard: string | null; sortOrder: number };

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) {
    return String((v as { text?: unknown }).text ?? "").trim();
  }
  return String(v).trim();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일이 필요합니다." }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("검측체크리스트양식") || wb.worksheets[0];
    if (!ws) return NextResponse.json({ error: "시트를 읽을 수 없습니다." }, { status: 400 });

    const rows: Row[] = [];
    const seqBySub = new Map<string, number>();
    let lastSub = "";
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더
      const idCell = cellText(row.getCell(3).value);
      const noCell = cellText(row.getCell(4).value);
      const itemCell = cellText(row.getCell(5).value);
      const stdCell = cellText(row.getCell(6).value);
      const sub = UUID_RE.test(idCell) ? idCell.toLowerCase() : lastSub;
      if (UUID_RE.test(idCell)) lastSub = idCell.toLowerCase();
      if (!sub || !itemCell) return; // 항목 없는 행(공종만 있는 빈 행 포함) 건너뜀
      const seq = (seqBySub.get(sub) || 0) + 1;
      seqBySub.set(sub, seq);
      const no = parseInt(noCell.replace(/[^0-9]/g, ""), 10);
      rows.push({
        subTypeId: sub,
        itemNo: Number.isFinite(no) && no > 0 ? no : seq,
        checkItem: itemCell,
        standard: stdCell || null,
        sortOrder: seq,
      });
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "입력된 검사항목이 없습니다. 양식에 항목을 작성했는지 확인하세요." }, { status: 400 });
    }

    const subIds = Array.from(new Set(rows.map((r) => r.subTypeId)));
    // 업로드에 포함된 공종의 기존 프리셋 교체
    await db.delete(checklistPresets).where(inArray(checklistPresets.subTypeId, subIds));
    await db.insert(checklistPresets).values(
      rows.map((r) => ({
        subTypeId: r.subTypeId,
        itemNo: r.itemNo,
        checkItem: r.checkItem,
        standard: r.standard,
        sortOrder: r.sortOrder,
      }))
    );

    return NextResponse.json({ ok: true, items: rows.length, subTypes: subIds.length });
  } catch (e) {
    console.error("[checklist-presets:upload]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "업로드 오류: " + msg }, { status: 500 });
  }
}
