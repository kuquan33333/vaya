import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!token || !accountId || !databaseId) {
  throw new Error("CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_D1_DATABASE_ID are required");
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) {
    throw new Error(`D1 query failed (${response.status}): ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.result?.[0]?.results ?? [];
}

const migrationDirectory = join(process.cwd(), "migrations");
const migrations = (await readdir(migrationDirectory))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();
if (migrations.length === 0) throw new Error("No migration files found");

await query(`CREATE TABLE IF NOT EXISTS vaya_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

let applied = new Set((await query("SELECT name FROM vaya_schema_migrations")).map((row) => row.name));

// The first deployment of this repository used direct D1 API queries before a
// migration ledger existed. Baseline only when all known pre-ledger tables are
// present; never silently skip a partially initialized database.
if (applied.size === 0) {
  const tables = new Set((await query("SELECT name FROM sqlite_master WHERE type = 'table'")).map((row) => row.name));
  const expected = ["leads", "providers", "policy_chunks", "crawl_alert_outbox", "review_queue", "rate_history"];
  if (expected.every((table) => tables.has(table))) {
    const columns = new Set((await query("PRAGMA table_info(lead_documents)")).map((row) => row.name));
    const baseline = columns.has("telegram_message_id") ? migrations : migrations.filter((file) => file < "0008_");
    for (const name of baseline) {
      await query("INSERT OR IGNORE INTO vaya_schema_migrations (name) VALUES (?)", [name]);
    }
    applied = new Set(baseline);
  }
}

for (const name of migrations) {
  if (applied.has(name)) continue;
  const sql = await readFile(join(migrationDirectory, name), "utf8");
  console.log(`Applying ${name}`);
  await query(sql);
  await query("INSERT INTO vaya_schema_migrations (name) VALUES (?)", [name]);
}

console.log(`D1 migrations up to date: ${migrations.length} file(s)`);
