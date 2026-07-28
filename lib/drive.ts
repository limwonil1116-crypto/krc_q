import { google } from "googleapis";
import { Readable } from "node:stream";

function driveClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2 });
}

type Drive = ReturnType<typeof driveClient>;

function sanitize(name: string) {
  return (name || "untitled").replace(/['\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "untitled";
}

// 동시 업로드 시 같은 폴더가 중복 생성되지 않도록 진행 중 요청을 공유
const folderPromises = new Map<string, Promise<string>>();
async function ensureFolder(drive: Drive, name: string, parentId: string): Promise<string> {
  const key = parentId + "/" + sanitize(name);
  const inflight = folderPromises.get(key);
  if (inflight) return inflight;
  const p = ensureFolderInner(drive, name, parentId);
  folderPromises.set(key, p);
  try {
    return await p;
  } catch (e) {
    folderPromises.delete(key);
    throw e;
  }
}
async function ensureFolderInner(drive: Drive, name: string, parentId: string): Promise<string> {
  const safe = sanitize(name);
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${safe.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
  ].join(" and ");
  const list = await drive.files.list({ q, fields: "files(id,name)", pageSize: 1 });
  const found = list.data.files?.[0];
  if (found?.id) return found.id;
  const created = await drive.files.create({
    requestBody: {
      name: safe,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return created.data.id as string;
}

export async function ensureFolderPath(names: string[]): Promise<string | undefined> {
  const root = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!root) return undefined;
  const drive = driveClient();
  let parent = root;
  for (const n of names) {
    if (!n) continue;
    parent = await ensureFolder(drive, n, parent);
  }
  return parent;
}

export async function uploadToDrive(params: {
  name: string;
  mimeType: string;
  buffer: Buffer;
  folderPath?: string[];
}) {
  const drive = driveClient();
  let folder: string | undefined = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (params.folderPath && params.folderPath.length > 0) {
    const target = await ensureFolderPath(params.folderPath);
    if (target) folder = target;
  }
  const res = await drive.files.create({
    requestBody: { name: params.name, parents: folder ? [folder] : undefined },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: "id, name, webViewLink",
  });
  return { id: res.data.id as string, webViewLink: (res.data.webViewLink as string) || "" };
}

export async function deleteFromDrive(fileId: string) {
  const drive = driveClient();
  await drive.files.delete({ fileId });
}

export async function getDriveStream(fileId: string): Promise<NodeJS.ReadableStream> {
  const drive = driveClient();
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  return res.data as unknown as NodeJS.ReadableStream;
}

// 브라우저가 드라이브로 직접 업로드할 수 있는 재개가능 업로드 세션 생성
// (서버는 URL 만 만들고 파일 본문은 통과시키지 않음 -> 용량 제한 없음)
export async function createResumableSession(params: {
  name: string;
  mimeType: string;
  folderPath?: string[];
}): Promise<{ uploadUrl: string; folderId?: string } | null> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const at = await oauth2.getAccessToken();
  const token = typeof at === "string" ? at : at?.token;
  if (!token) return null;
  let folder: string | undefined = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (params.folderPath && params.folderPath.length > 0) {
    const target = await ensureFolderPath(params.folderPath);
    if (target) folder = target;
  }
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,size",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType,
      },
      body: JSON.stringify({
        name: params.name,
        parents: folder ? [folder] : undefined,
      }),
    }
  );
  if (!res.ok) return null;
  const uploadUrl = res.headers.get("location");
  return uploadUrl ? { uploadUrl, folderId: folder } : null;
}

// 폴더 안에서 파일명으로 방금 올린 파일의 id/링크/크기를 조회 (CORS 로 클라가 응답을 못 읽을 때 사용)
export async function findDriveFileByName(
  folderId: string,
  name: string
): Promise<{ id: string; webViewLink: string; size: number } | null> {
  const drive = driveClient();
  const safe = name.split("'").join("");
  const q = [
    "trashed=false",
    `'${folderId}' in parents`,
    `name='${safe}'`,
  ].join(" and ");
  const list = await drive.files.list({
    q,
    fields: "files(id,webViewLink,size,createdTime)",
    orderBy: "createdTime desc",
    pageSize: 1,
  });
  const f = list.data.files?.[0];
  if (!f?.id) return null;
  return { id: f.id, webViewLink: (f.webViewLink as string) || "", size: Number(f.size || 0) };
}

// resumable 세션 URL 에 한 조각(chunk)을 Content-Range 로 PUT 한다.
// 서버(node)->구글 통신이라 CORS 제약이 없다.
// 반환: 아직 남았으면 {done:false}, 마지막 조각이면 {done:true, file}
export async function uploadChunkToSession(
  uploadUrl: string,
  chunk: Buffer,
  start: number,
  total: number
): Promise<{ done: boolean; file?: { id: string; webViewLink: string; size: number } }> {
  const end = start + chunk.length - 1;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
    body: chunk as unknown as BodyInit,
  });
  // 308 Resume Incomplete = 더 보낼 조각이 있음
  if (res.status === 308) return { done: false };
  if (res.status === 200 || res.status === 201) {
    const d = (await res.json().catch(() => ({}))) as {
      id?: string;
      webViewLink?: string;
      size?: string;
    };
    return {
      done: true,
      file: { id: d.id || "", webViewLink: d.webViewLink || "", size: Number(d.size || 0) },
    };
  }
  const txt = await res.text().catch(() => "");
  throw new Error(`청크 업로드 실패 ${res.status}: ${txt.slice(0, 200)}`);
}
