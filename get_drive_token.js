// 1회용: 구글 드라이브 refresh token 발급
// 사전: .env.local 에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 추가
// 실행: node --env-file=.env.local get_drive_token.js
// 결과: 출력된 GOOGLE_REFRESH_TOKEN 을 .env.local 에 추가
const http = require("http");
const { google } = require("googleapis");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 5179;
const REDIRECT = "http://localhost:" + PORT;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("[오류] .env.local 에 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 가 없습니다.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, REDIRECT);
    const code = u.searchParams.get("code");
    if (!code) {
      res.end("no code");
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    res.end("완료! 터미널로 돌아가세요. 이 창은 닫아도 됩니다.");
    console.log("\n=== 아래 한 줄을 .env.local 에 추가하세요 ===");
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("===========================================\n");
    server.close();
    process.exit(0);
  } catch (e) {
    res.end("error: " + e.message);
    console.error(e);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("\n브라우저에서 아래 주소를 열고 동의하세요:\n");
  console.log(url + "\n");
});
