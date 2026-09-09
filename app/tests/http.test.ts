import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/server.ts';

test('TP-API-001..004 exposes Phase 1 read APIs', async () => {
  const { server, close } = createApp({ dbPath: ':memory:', seed: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address: any = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const jobs = await (await fetch(`${base}/api/jobs?risk=MEDIUM`)).json();
  assert.ok(jobs.items.length >= 1);
  const detail = await (await fetch(`${base}/api/jobs/${jobs.items[0].id}`)).json();
  assert.ok(Array.isArray(detail.verifications));
  assert.equal((await fetch(`${base}/api/resumes`)).status, 200);
  assert.equal((await fetch(`${base}/api/baselines`)).status, 200);
  await close();
});

test('TP-UI-001 home serves JD list shell', async () => {
  const { server, close } = createApp({ dbPath: ':memory:', seed: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address: any = server.address();
  const html = await (await fetch(`http://127.0.0.1:${address.port}/`)).text();
  assert.match(html, /JD 列表/);
  await close();
});

test('TP-API-008..010 default jobs expose only target candidate projection', async (t) => {
  const { server, close, db } = createApp({ dbPath: ':memory:', seed: true });
  t.after(async () => { await close(); });
  const rows: any[] = db.prepare('SELECT id FROM jobs ORDER BY id LIMIT 6').all() as any[];
  assert.ok(rows.length >= 6);
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('AI Agent开发工程师', '3-5年', rows[0].id);
  db.prepare('UPDATE jobs SET title=? WHERE id=?').run('AI Agent开发实习生', rows[1].id);
  db.prepare('UPDATE jobs SET title=? WHERE id=?').run('AI Agent研发负责人', rows[2].id);
  db.prepare('UPDATE jobs SET title=? WHERE id=?').run('青浦超市兼职店员', rows[3].id);
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('AI Agent应用开发工程师', '在校/应届', rows[4].id);
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('【27届】AI Agent开发工程师', '经验不限', rows[5].id);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const candidates = await (await fetch(`${base}/api/jobs`)).json();
  const candidateTitles = candidates.items.map((item:any) => item.title);
  assert.ok(candidateTitles.includes('AI Agent开发工程师'));
  assert.ok(!candidateTitles.includes('AI Agent开发实习生'));
  assert.ok(!candidateTitles.includes('AI Agent研发负责人'));
  assert.ok(!candidateTitles.includes('青浦超市兼职店员'));
  assert.ok(!candidateTitles.includes('AI Agent应用开发工程师'));
  assert.ok(!candidateTitles.includes('【27届】AI Agent开发工程师'));
  const raw = await (await fetch(`${base}/api/jobs?scope=all`)).json();
  assert.ok(raw.items.some((item:any) => item.title === 'AI Agent开发实习生'));
  assert.ok(raw.items.some((item:any) => item.title === 'AI Agent研发负责人'));
  assert.ok(raw.items.some((item:any) => item.title === '青浦超市兼职店员'));
  assert.ok(raw.items.some((item:any) => item.title === 'AI Agent应用开发工程师' && item.experience_text === '在校/应届'));
  assert.ok(raw.items.some((item:any) => item.title === '【27届】AI Agent开发工程师'));
});

test('TP-UI-002..003..007..008 v0.7 shell is compact and merges profile', async () => {
  const { server, close } = createApp({ dbPath: ':memory:', seed: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const html = await (await fetch(`${base}/`)).text();
  const js = await (await fetch(`${base}/app.js`)).text();
  const css = await (await fetch(`${base}/styles.css`)).text();
  assert.equal((html.match(/class="nav/g) || []).length, 3);
  assert.doesNotMatch(html, /data-view="personal-profile"/);
  assert.match(js, /recruiter_activity/);
  assert.match(js, /showPersonalInfo/);
  assert.doesNotMatch(css, /grid-template-columns:232px 1fr/);
  await close();
});


test('TP-API-013 default projection follows current multi-route job strategy', async (t) => {
  const { server, close, db } = createApp({ dbPath: ':memory:', seed: true });
  t.after(async () => { await close(); });
  const rows:any[] = db.prepare('SELECT id FROM jobs ORDER BY id LIMIT 4').all() as any[];
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('高级全栈开发工程师（偏前端）','5-10年',rows[0].id);
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('研发效能全栈工程师','5-10年',rows[1].id);
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('FDE 全栈工程师','5-10年',rows[2].id);
  db.prepare('UPDATE jobs SET title=?,experience_text=? WHERE id=?').run('AI Agent研发负责人','5-10年',rows[3].id);
  await new Promise<void>((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const body:any=await (await fetch(`${base}/api/jobs`)).json();
  const titles=body.items.map((x:any)=>x.title);
  assert.ok(titles.includes('高级全栈开发工程师（偏前端）'));
  assert.ok(titles.includes('研发效能全栈工程师'));
  assert.ok(titles.includes('FDE 全栈工程师'));
  assert.ok(!titles.includes('AI Agent研发负责人'));
});
