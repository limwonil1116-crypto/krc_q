const postgres = require("postgres");
const url = process.env.DATABASE_URL || "";
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@(.+)$/);
if (!m) {
  console.error("URL parse FAIL. raw length:", url.length);
  console.error("raw start:", url.slice(0, 30));
  process.exit(1);
}
const user = m[1], pw = m[2], rest = m[3];
console.log("user      :", user);
console.log("pw length :", pw.length, " first2:", pw.slice(0, 2), " last2:", pw.slice(-2));
console.log("host part :", rest);
const sql = postgres(url, { prepare: false, ssl: "require" });
sql.unsafe("select 1 as ok")
  .then((r) => { console.log("RESULT OK", JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.error("RESULT FAIL", e.code, "-", e.message); process.exit(1); });
