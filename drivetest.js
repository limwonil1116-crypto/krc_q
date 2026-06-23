// 드라이브 연결 검증: 폴더에 테스트 파일 업로드 후 삭제
// 실행: node --env-file=.env.local drivetest.js
const { google } = require("googleapis");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH) {
  console.error("[오류] CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN 중 누락이 있습니다.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: REFRESH });
const drive = google.drive({ version: "v3", auth: oauth2 });

(async () => {
  try {
    const created = await drive.files.create({
      requestBody: { name: "krc_drivetest.txt", parents: FOLDER ? [FOLDER] : undefined },
      media: { mimeType: "text/plain", body: "ok" },
      fields: "id,name,webViewLink",
    });
    console.log("DRIVE OK  업로드 성공 ->", created.data.id, created.data.name);
    await drive.files.delete({ fileId: created.data.id });
    console.log("테스트 파일 삭제 완료. 드라이브 연결 정상 ✅");
    if (!FOLDER) console.log("(참고) GOOGLE_DRIVE_FOLDER_ID 가 없어 내 드라이브 루트에 올렸습니다. 폴더 지정 권장.");
  } catch (e) {
    const msg = (e.errors && e.errors[0] && e.errors[0].message) || e.message;
    console.error("DRIVE FAIL:", msg);
    process.exit(1);
  }
})();
