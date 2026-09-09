import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../server/db.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATIONS = resolve(ROOT, 'app/db/migrations');
const now = '2026-09-07T00:00:00.000Z';
const count = (db: DatabaseSync, table: string) => Number((db.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as any).c);
const tables = (db: DatabaseSync) => db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all().map((row:any) => row.name);

function applyLegacyMigration(db: DatabaseSync, version: number, file: string) {
  const sql = readFileSync(resolve(MIGRATIONS, file), 'utf8');
  db.exec(sql);
  const checksum = createHash('sha256').update(sql).digest('hex');
  db.prepare('INSERT INTO schema_migrations(id,version,name,checksum,applied_at) VALUES(?,?,?,?,?)')
    .run(`migration-${String(version).padStart(3, '0')}`, version, file.replace(/^\d+_/, '').replace(/\.sql$/, ''), checksum, now);
}
function createLegacyDb(path: string) {
  const db = new DatabaseSync(path);
  applyLegacyMigration(db, 1, '001_initial.sql');
  applyLegacyMigration(db, 2, '002_v03.sql');
  db.prepare("INSERT INTO providers(id,code,name,enabled,created_at,updated_at) VALUES('p1','legacy','Legacy',1,?,?)").run(now, now);
  db.prepare(`INSERT INTO jobs(id,provider_id,identity_fingerprint,origin_kind,title,company,jd_text,current_verification_status,education_risk,is_viewed,first_seen_at,last_seen_at,created_at,updated_at)
    VALUES('legacy-job','p1','legacy-fp','HISTORICAL_IMPORT','Legacy Job','Legacy Co','legacy jd','STALE','LOW',0,?,?,?,?)`)
    .run(now, now, now, now);
  db.close();
}

const coreTables = [
  'interview_sources','interview_source_documents','interview_source_units',
  'interview_signals','interview_role_profiles','interview_scene_profiles',
  'interview_question_families','interview_questions','interview_question_variants','interview_question_edges','interview_scoring_anchors',
  'interview_evidence_refs','interview_claim_boundaries','interview_question_evidence_links','interview_answer_blueprints','interview_job_focus',
  'interview_sessions','interview_turns','interview_session_signals','interview_session_hypotheses','interview_session_risks','interview_claim_debts',
  'interview_feedback_events','interview_training_events','interview_idempotency_requests','interview_question_search'
];
test('TP-IDB-001 fresh DB creates Interview bounded-context schema and minimal seeds', () => {
  const db = openDatabase(':memory:');
  try {
    const names = tables(db);
    for (const name of coreTables) assert.ok(names.includes(name), `${name} missing`);
    assert.equal(count(db, 'interview_signals'), 10);
    assert.equal(count(db, 'interview_role_profiles'), 3);
    assert.ok(count(db, 'interview_scene_profiles') >= 8);
    assert.ok(count(db, 'interview_question_families') >= 3 && count(db, 'interview_question_families') <= 8);
    assert.equal(count(db, 'interview_questions'), 0, 'DB-1 must not seed a question corpus');
  } finally { db.close(); }
});

test('TP-IDB-002 existing 001+002 DB upgrades without changing existing Job Search rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'interview-upgrade-'));
  const path = join(dir, 'job-search.db');
  try {
    createLegacyDb(path);
    const db = openDatabase(path);
    try {
      assert.equal((db.prepare("SELECT title FROM jobs WHERE id='legacy-job'").get() as any).title, 'Legacy Job');
      assert.ok(tables(db).includes('interview_sessions'));
      assert.equal((db.prepare('SELECT COUNT(*) c FROM schema_migrations WHERE version=3').get() as any).c, 1);
    } finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('TP-IDB-003 reopen is idempotent: migration checksum and minimal seed counts stay stable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'interview-reopen-'));
  const path = join(dir, 'job-search.db');
  try {
    const first = openDatabase(path);
    const before = {
      migration: first.prepare('SELECT checksum FROM schema_migrations WHERE version=3').get() as any,
      signals: count(first, 'interview_signals'), routes: count(first, 'interview_role_profiles'),
      scenes: count(first, 'interview_scene_profiles'), families: count(first, 'interview_question_families')
    };
    first.close();
    const second = openDatabase(path);
    try {
      assert.equal((second.prepare('SELECT COUNT(*) c FROM schema_migrations WHERE version=3').get() as any).c, 1);
      assert.equal((second.prepare('SELECT checksum FROM schema_migrations WHERE version=3').get() as any).checksum, before.migration.checksum);
      assert.deepEqual([count(second,'interview_signals'),count(second,'interview_role_profiles'),count(second,'interview_scene_profiles'),count(second,'interview_question_families')], [before.signals,before.routes,before.scenes,before.families]);
    } finally { second.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('TP-IDB-004 stable semantic keys are unique', () => {
  const db = openDatabase(':memory:');
  try {
    assert.ok(tables(db).includes('interview_question_families'));
    assert.throws(() => db.prepare("INSERT INTO interview_question_families(id,name,lifecycle,created_at,updated_at) VALUES('qf.build-vs-buy','dup','ACTIVE',?,?)").run(now, now));
  } finally { db.close(); }
});
test('TP-IDB-005 provenance key supports deterministic import idempotency', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare("INSERT INTO interview_sources(id,name,grade,lifecycle,created_at,updated_at) VALUES('source.test','Test','B','ACTIVE',?,?)").run(now, now);
    db.prepare("INSERT INTO interview_source_documents(id,source_id,title,canonical_url,content_hash,lifecycle,created_at,updated_at) VALUES('doc.test','source.test','Doc','https://example.test/doc','h1','ACTIVE',?,?)").run(now, now);
    const stmt = db.prepare("INSERT INTO interview_source_units(id,source_document_id,provenance_key,unit_kind,summary,lifecycle,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',?,?) ON CONFLICT(provenance_key) DO NOTHING");
    for (const id of ['unit-1','unit-2']) stmt.run(id,'doc.test','prov:abc','QUESTION','same unit',now,now);
    assert.equal(count(db, 'interview_source_units'), 1);
  } finally { db.close(); }
});

test('TP-IDB-006 UUID events with equal content remain distinct events', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare("INSERT INTO interview_sessions(id,mode,route_id,scene_id,status,strategy_version,created_at,updated_at) VALUES('s1','VOICE','route.ai-agent-devtools','scene.tech1','ACTIVE','v1',?,?)").run(now, now);
    const insert = db.prepare("INSERT INTO interview_feedback_events(id,session_id,event_type,target_type,target_id,observation,created_at) VALUES(?,?,?,?,?,?,?)");
    insert.run(randomUUID(),'s1','VOICE_SCORE','QUESTION_FAMILY','qf.build-vs-buy','same observation',now);
    insert.run(randomUUID(),'s1','VOICE_SCORE','QUESTION_FAMILY','qf.build-vs-buy','same observation',now);
    assert.equal(count(db, 'interview_feedback_events'), 2);
  } finally { db.close(); }
});
test('TP-IDB-007 FK, lifecycle and enum checks fail closed', () => {
  const db = openDatabase(':memory:');
  try {
    for (const name of ['interview_sessions','interview_question_families','interview_turns']) assert.ok(tables(db).includes(name), `${name} missing`);
    assert.throws(() => db.prepare("INSERT INTO interview_sessions(id,mode,route_id,scene_id,status,strategy_version,created_at,updated_at) VALUES('bad','INVALID','route.ai-agent-devtools','scene.tech1','ACTIVE','v1',?,?)").run(now, now));
    assert.throws(() => db.prepare("INSERT INTO interview_question_families(id,name,lifecycle,created_at,updated_at) VALUES('qf.invalid','Invalid','BROKEN',?,?)").run(now, now));
    assert.throws(() => db.prepare("INSERT INTO interview_turns(id,session_id,turn_index,turn_intent,created_at) VALUES('t1','missing-session',1,'ASK',?)").run(now));
  } finally { db.close(); }
});

test('TP-IDB-008 Question Family ↔ Evidence link requires a real matching Claim Boundary', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare("INSERT INTO interview_evidence_refs(id,stable_key,canonical_path,evidence_status,lifecycle,created_at,updated_at) VALUES('ev.test','ev.test','career-assets/职业事实.md','SUPPORTED','ACTIVE',?,?)").run(now, now);
    db.prepare("INSERT INTO interview_evidence_refs(id,stable_key,canonical_path,evidence_status,lifecycle,created_at,updated_at) VALUES('ev.other','ev.other','career-assets/事实台账.md','SUPPORTED','ACTIVE',?,?)").run(now, now);
    assert.throws(() => db.prepare("INSERT INTO interview_question_evidence_links(id,question_family_id,evidence_ref_id,claim_boundary_id,strength,created_at,updated_at) VALUES('link.bad','qf.build-vs-buy','ev.test','cb.missing','STRONG',?,?)").run(now, now));
    db.prepare("INSERT INTO interview_claim_boundaries(id,evidence_ref_id,boundary_type,allowed_claim,forbidden_expansion,lifecycle,created_at,updated_at) VALUES('cb.test','ev.test','SAFE_DIRECT','safe','do not expand','ACTIVE',?,?)").run(now, now);
    db.prepare("INSERT INTO interview_claim_boundaries(id,evidence_ref_id,boundary_type,allowed_claim,forbidden_expansion,lifecycle,created_at,updated_at) VALUES('cb.other','ev.other','SAFE_DIRECT','other','other only','ACTIVE',?,?)").run(now, now);
    assert.throws(() => db.prepare("INSERT INTO interview_question_evidence_links(id,question_family_id,evidence_ref_id,claim_boundary_id,strength,created_at,updated_at) VALUES('link.mismatch','qf.build-vs-buy','ev.test','cb.other','STRONG',?,?)").run(now, now));
    db.prepare("INSERT INTO interview_question_evidence_links(id,question_family_id,evidence_ref_id,claim_boundary_id,strength,created_at,updated_at) VALUES('link.good','qf.build-vs-buy','ev.test','cb.test','STRONG',?,?)").run(now, now);
    assert.equal(count(db, 'interview_question_evidence_links'), 1);
  } finally { db.close(); }
});
test('TP-IDB-009 session job FK is optional but validated when present', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare("INSERT INTO interview_sessions(id,mode,route_id,scene_id,status,strategy_version,created_at,updated_at) VALUES('s-null','VOICE','route.ai-agent-devtools','scene.tech1','ACTIVE','v1',?,?)").run(now, now);
    assert.throws(() => db.prepare("INSERT INTO interview_sessions(id,mode,route_id,scene_id,job_id,status,strategy_version,created_at,updated_at) VALUES('s-bad','VOICE','route.ai-agent-devtools','scene.tech1','missing-job','ACTIVE','v1',?,?)").run(now, now));
    db.prepare("INSERT INTO providers(id,code,name,enabled,created_at,updated_at) VALUES('p-test','test','Test',1,?,?)").run(now, now);
    db.prepare(`INSERT INTO jobs(id,provider_id,identity_fingerprint,origin_kind,title,company,jd_text,current_verification_status,education_risk,is_viewed,first_seen_at,last_seen_at,created_at,updated_at)
      VALUES('job-test','p-test','fp-test','LIVE_DISCOVERY','Role','Co','','NEW','LOW',0,?,?,?,?)`).run(now,now,now,now);
    db.prepare("INSERT INTO interview_sessions(id,mode,route_id,scene_id,job_id,status,strategy_version,created_at,updated_at) VALUES('s-job','VOICE','route.ai-agent-devtools','scene.tech1','job-test','ACTIVE','v1',?,?)").run(now, now);
    assert.equal((db.prepare("SELECT job_id FROM interview_sessions WHERE id='s-job'").get() as any).job_id, 'job-test');
  } finally { db.close(); }
});

test('TP-IDB-010 FTS5 is available and trigram recalls Chinese substrings that unicode61 misses', () => {
  const db = openDatabase(':memory:');
  try {
    const schema = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='interview_question_search'").get() as any).sql;
    assert.match(schema, /fts5/i);
    assert.match(schema, /trigram/i);
    db.exec("CREATE VIRTUAL TABLE temp.fts_unicode USING fts5(text, tokenize='unicode61'); CREATE VIRTUAL TABLE temp.fts_trigram USING fts5(text, tokenize='trigram');");
    db.prepare('INSERT INTO temp.fts_unicode(text) VALUES(?)').run('多智能体运行时状态恢复');
    db.prepare('INSERT INTO temp.fts_trigram(text) VALUES(?)').run('多智能体运行时状态恢复');
    const unicode = Number((db.prepare("SELECT COUNT(*) c FROM temp.fts_unicode WHERE fts_unicode MATCH '运行时状态'").get() as any).c);
    const trigram = Number((db.prepare("SELECT COUNT(*) c FROM temp.fts_trigram WHERE fts_trigram MATCH '运行时状态'").get() as any).c);
    assert.equal(unicode, 0); assert.equal(trigram, 1);
  } finally { db.close(); }
});
test('TP-IDB-011 request idempotency ledger rejects duplicate write identities', () => {
  const db = openDatabase(':memory:');
  try {
    const stmt = db.prepare("INSERT INTO interview_idempotency_requests(request_id,operation,status,response_json,created_at,updated_at) VALUES(?,?,?,?,?,?)");
    stmt.run('req-1','interview.observe_answer','APPLIED','{"ok":true}',now,now);
    assert.throws(() => stmt.run('req-1','interview.observe_answer','APPLIED','{"ok":true}',now,now));
    assert.equal(count(db, 'interview_idempotency_requests'), 1);
  } finally { db.close(); }
});

test('TP-IDB-012 DB-1 contains no vector/embedding schema or bulk question seed', () => {
  const db = openDatabase(':memory:');
  try {
    const names = tables(db).join('\n');
    assert.doesNotMatch(names, /vector|embedding|vec1/i);
    assert.equal(count(db, 'interview_questions'), 0);
  } finally { db.close(); }
});
