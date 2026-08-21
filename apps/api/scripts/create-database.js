import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const target = new URL(process.env.DATABASE_URL);
const databaseName = target.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
  throw new Error("DATABASE_URL contains an invalid database name.");
}

target.pathname = "/postgres";
const client = new pg.Client({ connectionString: target.toString() });
await client.connect();

try {
  const existing = await client.query("select 1 from pg_database where datname = $1", [databaseName]);
  if (existing.rowCount) {
    console.log(`Database ${databaseName} already exists.`);
  } else {
    await client.query(`create database "${databaseName}"`);
    console.log(`Created database ${databaseName}.`);
  }
} finally {
  await client.end();
}
