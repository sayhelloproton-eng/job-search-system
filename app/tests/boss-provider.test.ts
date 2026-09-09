import test from 'node:test';
import assert from 'node:assert/strict';

async function bossModule() {
  return import('../server/providers/boss.ts');
}

test('TP-BOSS-004 Phase 1 uses boss-agent-cli argv only', async () => {
  const mod: any = await bossModule();
  assert.equal(mod.BOSS_PHASE1_CONTROL_MODE, 'boss-agent-cli');
  assert.equal(mod.BOSS_EXTERNAL_BROWSER_FALLBACK, false);
  assert.equal(mod.BOSS_PHASE1_READ_ONLY, true);
  assert.deepEqual(mod.BOSS_PHASE1_CAPABILITIES, ['discovery', 'detail', 'verification']);

  const command = mod.buildBossSearchCommand('AI Agent; echo hacked', {
    city: '上海', page: 2
  });
  assert.equal(command.file, 'boss');
  assert.equal(command.shell, false);
  assert.deepEqual(command.args, [
    'search', 'AI Agent; echo hacked', '--city', '上海', '--page', '2', '--no-cache'
  ]);
});

test('TP-BOSS-005 CLI runner has timeout and parse errors', async () => {
  const mod: any = await bossModule();
  const ok = await mod.runBossCliJson(
    ['{"ok":true,"data":[1]}'],
    { executable: '/bin/echo', timeoutMs: 5000 }
  );
  assert.equal(ok.ok, true);

  await assert.rejects(
    mod.runBossCliJson(['not-json'], {
      executable: '/bin/echo', timeoutMs: 5000
    }),
    (error: any) => error?.code === 'CLI_INVALID_JSON'
  );
  await assert.rejects(
    mod.runBossCliJson(['1'], {
      executable: '/bin/sleep', timeoutMs: 20
    }),
    (error: any) => error?.code === 'CLI_TIMEOUT'
  );
});

test('TP-BOSS-008 sanitizer removes provider secrets recursively', async () => {
  const mod: any = await bossModule();
  const sanitized = mod.sanitizeBossObservation({
    title: 'Agent Engineer', securityId: 'secret-a',
    nested: { token: 'secret-b', cookie: 'secret-c', recruiter: '王女士' },
    items: [{ security_id: 'secret-d', job_id: 'job-1' }]
  });
  assert.deepEqual(sanitized, {
    title: 'Agent Engineer',
    nested: { recruiter: '王女士' },
    items: [{ job_id: 'job-1' }]
  });
});

test('TP-BOSS-009 structured output normalizes fields and pagination', async () => {
  const mod: any = await bossModule();
  const parsed = mod.normalizeBossSearchPayload({
    ok: true,
    data: [{
      job_id: 'j1', title: 'AI Agent工程师', company: '示例公司', salary: '20-30K',
      city: '上海', district: '青浦区', experience: '3-5年', education: '本科',
      boss_name: '王女士', boss_title: 'HR', boss_active: '在线', security_id: 'secret'
    }],
    pagination: { page: 1, has_more: true, total: 15 }
  });
  assert.deepEqual(parsed.pagination, { page: 1, hasMore: true, total: 15 });
  assert.equal(parsed.jobs[0].externalJobId, 'j1');
  assert.equal(parsed.jobs[0].district, '青浦区');
  assert.equal(parsed.jobs[0].recruiterActivity, '在线');
  assert.equal(JSON.stringify(parsed).includes('security_id'), false);
  assert.equal(JSON.stringify(parsed).includes('secret'), false);
});

test('TP-BOSS-006 missing publish time and source URL stay missing', async () => {
  const mod: any = await bossModule();
  const parsed = mod.normalizeBossSearchPayload({
    ok: true,
    data: [{ job_id: 'j2', title: '前端Agent', company: '示例', city: '上海' }],
    pagination: { page: 1, has_more: false, total: 1 }
  });
  assert.equal(parsed.jobs[0].publishedAt, undefined);
  assert.equal(parsed.jobs[0].sourceUrl, undefined);
});

test('TP-BOSS-001/006/011 v0.5 keeps real Shanghai missing-time candidates without treating them as blocked', async () => {
  const mod: any = await bossModule();
  const result = mod.filterBossDiscovery([
    { id: 'recent', city: '上海', publishedAt: '2026-08-20T00:00:00Z' },
    { id: 'old', city: '上海', publishedAt: '2026-05-01T00:00:00Z' },
    { id: 'outside', city: '杭州', publishedAt: '2026-08-20T00:00:00Z' },
    { id: 'missing', city: '上海', publishedAt: null }
  ], new Date('2026-08-22T00:00:00Z'));
  assert.deepEqual(result.accepted.map((x: any) => x.id), ['recent', 'missing']);
  assert.deepEqual(result.blocked, []);
  assert.deepEqual(result.rejected.map((x: any) => x.id), ['old', 'outside']);
});


test('TP-BOSS-012 detail argv keeps security_id transient and pairs job_id for public CLI fast path', async () => {
  const mod: any = await bossModule();
  const command = mod.buildBossDetailCommand('transient-secret', 'job-public-1');
  assert.equal(command.file, 'boss');
  assert.equal(command.shell, false);
  assert.deepEqual(command.args, ['detail', 'transient-secret', '--job-id', 'job-public-1']);
});
