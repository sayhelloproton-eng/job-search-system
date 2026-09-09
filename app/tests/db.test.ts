import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';

test('TP-DB-001/002 fresh migration creates Phase 1 core tables without application/write tables', () => {
  const db = openDatabase(':memory:');
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r: any) => r.name);
  const phase1Core = ['job_match_results','job_snapshots','job_verifications','jobs','match_baselines','match_terms','providers','resumes','schema_migrations','search_runs'];
  for (const name of phase1Core) assert.ok(names.includes(name), `${name} missing`);
  for (const name of ['applications','application_events','application_approvals','application_browser_actions'])
    assert.equal(names.includes(name), false, `${name} must stay out of Phase 1`);
  db.close();
});

test('TP-DB-003 provider external id uniqueness is enforced', () => {
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO providers(id,code,name,enabled,created_at,updated_at) VALUES('p1','boss','BOSS',1,'x','x')").run();
  const sql = "INSERT INTO jobs(id,provider_id,external_job_id,identity_fingerprint,origin_kind,title,company,jd_text,current_verification_status,education_risk,is_viewed,first_seen_at,last_seen_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
  db.prepare(sql).run('j1','p1','e1','f1','LIVE_DISCOVERY','A','C','','NEW','LOW',0,'x','x','x','x');
  assert.throws(() => db.prepare(sql).run('j2','p1','e1','f2','LIVE_DISCOVERY','B','C','','NEW','LOW',0,'x','x','x','x'));
  db.close();
});
