import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = resolve(APP_ROOT, 'db/migrations');

function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)));
}

function hasMigrationTable(db: DatabaseSync) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
  ).get());
}

export function openDatabase(dbPath = resolve(APP_ROOT, 'db/runtime/job-search.db')) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  for (const file of migrationFiles()) {
    const version = Number(file.slice(0, 3));
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
    const sql = readFileSync(resolve(MIGRATIONS, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing: any = hasMigrationTable(db)
      ? db.prepare('SELECT checksum FROM schema_migrations WHERE version=?').get(version)
      : undefined;

    if (existing) {
      if (existing.checksum !== checksum) throw new Error('MIGRATION_CHECKSUM_MISMATCH');
      continue;
    }

    db.exec('BEGIN;');
    try {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations(id,version,name,checksum,applied_at) VALUES(?,?,?,?,?)'
      ).run(`migration-${String(version).padStart(3, '0')}`, version, name, checksum, new Date().toISOString());
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }

  return db;
}
