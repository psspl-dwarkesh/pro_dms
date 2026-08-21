import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Copy .env.example to apps/api/.env and set the PostgreSQL connection string.");
}

const root = resolve(import.meta.dirname, "../../../database");
const files = (await readdir(root)).filter((file) => file.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const file of files) {
    const sql = await readFile(resolve(root, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("select checksum from schema_migrations where filename = $1", [file]);

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration ${file} changed after it was applied. Add a new migration instead of editing released SQL.`);
      }
      console.log(`Already applied ${file}`);
      continue;
    }

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename, checksum) values ($1, $2)", [file, checksum]);
      await client.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
