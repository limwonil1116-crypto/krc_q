import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadChunkToSession } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

// 브라우저가 영상을 조각내 보내면, 서버가 그 조각을 드라이브 resumable 세션에 이어붙인다.
// (브라우저->구글 직접 PUT 은 CORS 로 막히므로 서버가 중계)
export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== "contractor" && role !== "client" && role !== "admin")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const fd = await req.formData();
    const uploadUrl = String(fd.get("uploadUrl") || "");
    const start = parseInt(String(fd.get("start") || "0"), 10);
    const total = parseInt(String(fd.get("total") || "0"), 10);
    const file = fd.get("chunk");
    if (!uploadUrl || !(file instanceof Blob) || !Number.isFinite(start) || !Number.isFinite(total)) {
      return NextResponse.json({ error: "청크 정보가 올바르지 않습니다." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const r = await uploadChunkToSession(uploadUrl, buffer, start, total);
    return NextResponse.json({ ok: true, done: r.done, file: r.file || null });
  } catch (e) {
    console.error("[records:video:chunk]", e);
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: "청크 업로드 오류: " + msg }, { status: 500 });
  }
}
