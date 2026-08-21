import assert from "node:assert/strict";
import test from "node:test";
import { poolConnectionOptions } from "../src/db.js";

test("Neon require mode becomes explicit certificate verification", () => {
  const options = poolConnectionOptions(
    "postgresql://user:secret@example.neon.tech/neondb?sslmode=require&channel_binding=require",
  );

  assert.equal(
    options.connectionString,
    "postgresql://user:secret@example.neon.tech/neondb?channel_binding=require",
  );
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
});

test("local database URLs remain unchanged", () => {
  const connectionString = "postgresql://user:secret@localhost:5432/autoaxis";
  assert.deepEqual(poolConnectionOptions(connectionString), { connectionString });
});
