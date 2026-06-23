// 앱 전용 드라이브 폴더 생성 후 ID 출력
// 실행: node --env-file=.env.local drive_makefolder.js
const { google } = require("googleapis");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH) {
  console.error("[오류] CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN 중 누락이 있습니다.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: REFRESH });
const drive = google.drive({ version: "v3", auth: oauth2 });

(async () => {
  try {
    const res = await drive.files.create({
      requestBody: {
        name: "현장기록 자동영상화",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id,name,webViewLink",
    });
    console.log("\n폴더 생성 완료:", res.data.name);
    console.log("웹에서 보기:", res.data.webViewLink);
    console.log("\n=== 아래 한 줄로 .env.local 의 GOOGLE_DRIVE_FOLDER_ID 를 교체하세요 ===");
    console.log("GOOGLE_DRIVE_FOLDER_ID=" + res.data.id);
    console.log("====================================================================\n");
  } catch (e) {
    const msg = (e.errors && e.errors[0] && e.errors[0].message) || e.message;
    console.error("FAIL:", msg);
    process.exit(1);
  }
})();
