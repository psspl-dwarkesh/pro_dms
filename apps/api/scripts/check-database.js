import "dotenv/config";
import { databaseStatus, pool } from "../src/persistence.js";

const requiredTables = ["customers", "vehicles", "interactions", "service_jobs"];
const status = await databaseStatus();

try {
  if (status.status !== "connected" || !pool) {
    console.error(JSON.stringify({ ok: false, database: status.status }));
    process.exitCode = 1;
  } else {
    const result = await pool.query(
      `select table_name
         from information_schema.tables
        where table_schema = 'public' and table_name = any($1::text[])
        order by table_name`,
      [requiredTables],
    );
    const present = result.rows.map((row) => row.table_name);
    const missing = requiredTables.filter((table) => !present.includes(table));
    console.log(JSON.stringify({ ok: missing.length === 0, database: "connected", latencyMs: status.latencyMs, requiredTables: present.length, missing }));
    if (missing.length) process.exitCode = 1;
  }
} finally {
  await pool?.end();
}
