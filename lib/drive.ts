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

async function ensureFolder(drive: Drive, name: string, parentId: string): Promise<string> {
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
