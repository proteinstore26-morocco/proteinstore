#!/usr/bin/env node
// Consistent SQLite snapshot (safe while the service is running).
import { backup } from "node:sqlite";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const source = process.env.ORDER_DB_PATH || join("data", "proteinstore.db");
const dir = process.env.ORDER_BACKUP_DIR || join("data", "backups");
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(dir, `proteinstore-${stamp}.db`);

// `backup` accepts a DatabaseSync instance; open the file read-only via a fresh handle.
const { DatabaseSync } = await import("node:sqlite");
const db = new DatabaseSync(source);
await backup(db, target);
db.close();

const keep = 14;
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".db"))
  .map((name) => join(dir, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
for (const old of files.slice(keep)) unlinkSync(old);
console.log(`[backup] ${target} (${files.length} kept, max ${keep})`);
