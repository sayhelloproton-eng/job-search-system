import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { ingestBossSearchPayload, runBossSearchIngestion, runBossSearchDetailIngestion } from '../server/ingestion.ts';

test('TP-DB-007 v0.5 persists real missing-time candidates without pretending they are proven-recent', () => {
  const db = openDatabase(':memory:');
  const baselineNow = '2026-08-22T00:00:00.000Z';
  db.prepare('INSERT INTO match_baselines(id,name,direction,description,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run('b-live','Agent / AI 工程方向','AI Agent','live ingestion evaluation',1,baselineNow,baselineNow);
  db.prepare('INSERT INTO match_terms(id,baseline_id,term,match_type,category,weight,notes,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('t-live-agent','b-live','Agent','STRONG_BOOST','核心能力',25,'test',1,baselineNow,baselineNow);
  const payload = {
    ok: true,
    data: [
      {
        job_id: 'boss-recent', title: 'AI Agent工程师', company: '示例科技',
        salary: '25-40K', city: '上海', district: '青浦区', experience: '3-5年',
        education: '本科', boss_name: '王女士', boss_active: '今日活跃',
        published_at: '2026-08-20T00:00:00Z',
        source_url: 'https://www.zhipin.com/job_detail/boss-recent.html?security_id=must-not-persist',
        security_id: 'must-not-persist'
      },
      {
        job_id: 'boss-missing-time', title: '前端Agent', company: '另一家公司',
        city: '上海', district: '浦东新区', security_id: 'also-secret'
      }
    ],
    pagination: { page: 1, has_more: false, total: 2 }
  };
  const result = ingestBossSearchPayload(db, payload, {
    query: 'AI Agent', city: '上海', now: new Date('2026-08-22T00:00:00Z')
  });
  assert.equal(result.newCount, 2);
  assert.equal(result.blockedCount, 0);

  const jobs: any[] = db.prepare('SELECT * FROM jobs ORDER BY id').all() as any[];
  assert.equal(jobs.length, 2);
  const recent: any = jobs.find((job) => job.external_job_id === 'boss-recent');
  const missing: any = jobs.find((job) => job.external_job_id === 'boss-missing-time');
  assert.equal(recent.published_at, '2026-08-20T00:00:00Z');
  assert.equal(recent.source_url, 'https://www.zhipin.com/job_detail/boss-recent.html');
  assert.equal(recent.current_verification_status, 'LISTED');
  assert.equal(missing.published_at, null);
  assert.equal(missing.source_url, null);
  assert.equal(missing.current_verification_status, 'LISTED');
  const matches: any[] = db.prepare('SELECT * FROM job_match_results ORDER BY job_id').all() as any[];
  assert.equal(matches.length, 2);
  assert.equal(matches.every((match) => match.baseline_id === 'b-live'), true);
  assert.equal(matches.every((match) => match.final_score === 75), true);
  assert.equal(matches.every((match) => Boolean(match.evaluator_version)), true);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM job_snapshots').get().c, 2);
  const verification: any = db.prepare('SELECT * FROM job_verifications WHERE job_id=?').get(missing.id);
  assert.equal(verification.status, 'LISTED');
  assert.equal(verification.method, 'BOSS_SEARCH_LIST');

  const run: any = db.prepare('SELECT * FROM search_runs ORDER BY created_at DESC LIMIT 1').get();
  assert.equal(run.found_count, 2);
  assert.equal(run.new_count, 2);
  assert.equal(run.blocked_count, 0);
  assert.match(run.error_summary, /PUBLISHED_AT_MISSING/);
  assert.equal(run.error_summary.includes('must-not-persist'), false);
  assert.equal(run.error_summary.includes('also-secret'), false);
  db.close();
});


test('TP-BOSS-010 real CLI-shaped search output flows through the formal ingestion application entry', async () => {
  const db = openDatabase(':memory:');
  let seenArgs: string[] | undefined;
  const result = await runBossSearchIngestion(db, 'AI Agent', {
    city: '上海',
    page: 1,
    now: new Date('2026-08-22T00:00:00Z'),
    runner: async (args: string[]) => {
      seenArgs = args;
      return {
        ok: true,
        data: [{
          job_id: 'live-shaped-1', title: 'AI Agent工程师', company: '真实形状示例',
          salary: '25-40K', city: '上海', district: '青浦区', experience: '3-5年',
          education: '本科', boss_name: '王女士', boss_active: '在线', security_id: 'never-persist'
        }],
        pagination: { page: 1, has_more: false, total: 1 }
      };
    }
  });
  assert.deepEqual(seenArgs, ['search', 'AI Agent', '--city', '上海', '--page', '1', '--no-cache']);
  assert.equal(result.newCount, 1);
  const job: any = db.prepare("SELECT * FROM jobs WHERE external_job_id='live-shaped-1'").get();
  assert.equal(job.published_at, null);
  assert.equal(job.current_verification_status, 'LISTED');
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM search_runs').all()).includes('never-persist'), false);
  db.close();
});


test('TP-BOSS-012 search detail enrichment persists public detail facts without provider secrets', async () => {
  const db = openDatabase(':memory:');
  const calls: string[][] = [];
  const runner = async (args: string[]) => {
    calls.push(args);
    if (args[0] === 'search') return {
      ok: true,
      data: [{ job_id: 'live-detail-1', title: 'AI Agent全栈工程师', company: '真实公司', city: '上海', district: '青浦区', education: '本科', boss_active: '离线', security_id: 'transient-search-secret' }],
      pagination: { page: 1, has_more: false, total: 1 }
    };
    if (args[0] === 'detail') return {
      ok: true,
      data: { job_id: 'live-detail-1', title: 'AI Agent全栈工程师', company: '真实公司', city: '上海', education: '本科', description: '负责 Agent 工作流、前端与服务端工程化。', address: '上海市青浦区示例路1号', boss_active: '刚刚活跃', security_id: 'transient-detail-secret' }
    };
    throw new Error('unexpected runner call');
  };

  const result: any = await runBossSearchDetailIngestion(db, 'AI Agent', { city: '上海', page: 1, runner });
  assert.equal(result.search.newCount, 1);
  assert.equal(result.detailSucceeded, 1);
  assert.equal(result.detailFailed, 0);
  assert.deepEqual(calls[1], ['detail', 'transient-search-secret', '--job-id', 'live-detail-1']);

  const job: any = db.prepare("SELECT * FROM jobs WHERE external_job_id='live-detail-1'").get();
  assert.equal(job.jd_text, '负责 Agent 工作流、前端与服务端工程化。');
  assert.equal(job.address, '上海市青浦区示例路1号');
  assert.equal(job.recruiter_activity, '刚刚活跃');
  assert.equal(job.current_verification_status, 'LISTED');
  const latest: any = db.prepare('SELECT * FROM job_snapshots WHERE job_id=? ORDER BY captured_at DESC LIMIT 1').get(job.id);
  assert.equal(latest.jd_text, job.jd_text);
  const dump = JSON.stringify({
    job,
    snapshots: db.prepare('SELECT * FROM job_snapshots').all(),
    verifications: db.prepare('SELECT * FROM job_verifications').all(),
    runs: db.prepare('SELECT * FROM search_runs').all()
  });
  assert.equal(dump.includes('transient-search-secret'), false);
  assert.equal(dump.includes('transient-detail-secret'), false);
  db.close();
});
