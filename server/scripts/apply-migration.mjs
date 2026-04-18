#!/usr/bin/env node
// Apply a single drizzle migration by tag name and record it in drizzle.__drizzle_migrations
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoServerDir = path.resolve(__dirname, '..');

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: node scripts/apply-migration.mjs <tag>');
  console.error('Example: node scripts/apply-migration.mjs 0001_etapa2_multiuser_migration1');
  process.exit(1);
}

const journalPath = path.join(repoServerDir, 'drizzle', 'meta', '_journal.json');
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const entry = journal.entries.find((e) => e.tag === tag);
if (!entry) {
  console.error(`Tag "${tag}" not found in _journal.json`);
  process.exit(1);
}

const sqlPath = path.join(repoServerDir, 'drizzle', `${tag}.sql`);
const sqlRaw = fs.readFileSync(sqlPath, 'utf8');
const hash = crypto.createHash('sha256').update(sqlRaw).digest('hex');

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL(_DIRECT) not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: existing } = await client.query(
    'SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1',
    [hash],
  );
  if (existing.length > 0) {
    console.log(`[migrate] ${tag} already applied (hash ${hash.slice(0, 12)})`);
    process.exit(0);
  }

  console.log(`[migrate] applying ${tag} ...`);
  const statements = sqlRaw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await client.query(stmt);
  }

  await client.query(
    'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
    [hash, entry.when],
  );
  console.log(`[migrate] ✓ ${tag} applied (${statements.length} statements, hash ${hash.slice(0, 12)})`);
} catch (err) {
  console.error(`[migrate] FAILED ${tag}:`, err.message);
  process.exit(1);
} finally {
  await client.end();
}
