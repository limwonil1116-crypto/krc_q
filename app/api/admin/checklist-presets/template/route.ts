import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { structureTypes } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }

  const all = await db
    .select({ id: structureTypes.id, name: structureTypes.name, parentId: structureTypes.parentId, sortOrder: structureTypes.sortOrder })
    .from(structureTypes)
    .where(eq(structureTypes.isActive, true))
    .orderBy(asc(structureTypes.sortOrder));

  const parentName = new Map<string, string>();
  all.filter((s) => !s.parentId).forEach((p) => parentName.set(p.id, p.name));
  // 세부공종(자식)만, 대분류별 정렬
  const children = all
    .filter((s) => s.parentId)
    .sort((a, b) => (parentName.get(a.parentId!) || "").localeCompare(parentName.get(b.parentId!) || "", "ko") || a.name.localeCompare(b.name, "ko"));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("검측체크리스트양식");
  ws.columns = [
    { header: "대분류(참고)", key: "cat", width: 16 },
    { header: "세부공종(공종)", key: "sub", width: 22 },
    { header: "공종ID(수정금지)", key: "id", width: 40 },
    { header: "No", key: "no", width: 6 },
    { header: "검사항목", key: "item", width: 60 },
    { header: "검사기준(시방)", key: "std", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0033A0" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // 각 세부공종마다 빈 입력행 1개씩 미리 제공 (대분류/세부공종/ID 채워서)
  for (const c of children) {
    ws.addRow({ cat: parentName.get(c.parentId!) || "", sub: c.name, id: c.id, no: "", item: "", std: "" });
  }

  // 안내 시트
  const guide = wb.addWorksheet("작성안내");
  const notes = [
    "[검측 체크리스트 양식 작성 안내]",
    "",
    "1. '검측체크리스트양식' 시트에 공종별 검사항목을 입력하세요.",
    "2. 대분류/세부공종/공종ID 는 이미 채워져 있습니다. 공종ID 는 절대 수정하지 마세요.",
    "3. 한 공종에 항목이 여러 개면, 그 공종 행 아래에 줄을 추가하세요.",
    "   추가한 줄은 대분류/세부공종/공종ID 를 비워 두어도 됩니다(위 공종에 자동 귀속).",
    "4. No 는 비워 두면 자동 번호가 매겨집니다.",
    "5. 검사항목은 필수, 검사기준(시방)은 선택입니다.",
    "6. 작성 후 .xlsx 로 저장하여 업로드하세요.",
    "7. 업로드하면 해당 공종의 기존 프리셋은 새 내용으로 교체됩니다.",
  ];
  notes.forEach((t) => guide.addRow([t]));
  guide.getColumn(1).width = 90;

  const buf = await wb.xlsx.writeBuffer();
  const fname = encodeURIComponent("검측체크리스트_양식.xlsx");
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fname}`,
    },
  });
}
