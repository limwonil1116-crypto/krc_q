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
}): Promise<{ uploadUrl: string } | null> {
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
  return uploadUrl ? { uploadUrl } : null;
}
