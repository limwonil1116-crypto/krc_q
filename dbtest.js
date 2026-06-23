const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
sql.unsafe("select count(*) from users")
  .then((r) => { console.log("OK", JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.error("FAIL", e.message); process.exit(1); });
