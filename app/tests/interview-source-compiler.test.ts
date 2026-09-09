import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import {
  AUDITED_INTERVIEW_SOURCES,
  registerAuditedInterviewSources,
  compileInterviewDocument,
  normalizeQuestionText,
} from '../server/interview-source-compiler.ts';

const NOW = '2026-09-07T03:00:00.000Z';
const count = (db:any, table:string) => Number((db.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as any).c);
const baseDoc = (sourceId:string, url:string, question:string, locator='q1') => ({
  sourceId, title: `fixture-${sourceId}`, canonicalUrl: url, capturedAt: NOW,
  units: [{ locator, kind: 'QUESTION' as const, text: question }],
});

test('TP-IDB2-001 audited registry materializes A/B/C sources from research layer', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    assert.equal(count(db, 'interview_sources'), 36);
    const grades = db.prepare('SELECT grade,COUNT(*) c FROM interview_sources GROUP BY grade ORDER BY grade').all() as any[];
    assert.deepEqual(grades.map(x => [x.grade, Number(x.c)]), [['A',27],['B',7],['C',2]]);
    assert.equal(AUDITED_INTERVIEW_SOURCES.length, 36);
  } finally { db.close(); }
});
test('TP-IDB2-002 normalization is deterministic without replacing source wording', () => {
  assert.equal(normalizeQuestionText('  1. 为什么不用  现成框架，而自己做？ '), '为什么不用 现成框架,而自己做?');
  assert.equal(normalizeQuestionText('Build  VS  Buy？'), 'build vs buy?');
});

test('TP-IDB2-003 different-source phrasings compile into the same stable family and signal', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    compileInterviewDocument(db, baseDoc('source.aipm-wiki','https://github.com/archlizheng/AIPM-Wiki','为什么不用现成框架，而选择自己实现？'));
    compileInterviewDocument(db, baseDoc('source.staffeng','https://staffeng.com/guides/staff-plus-interview-process/','面对 Build vs Buy，你为什么最终选择自研？'));
    const rows = db.prepare(`SELECT q.canonical_text,q.question_family_id,f.primary_signal_id
      FROM interview_questions q JOIN interview_question_families f ON f.id=q.question_family_id ORDER BY q.id`).all() as any[];
    assert.equal(rows.length, 2);
    assert.deepEqual(new Set(rows.map(r => r.question_family_id)), new Set(['qf.build-vs-buy']));
    assert.deepEqual(new Set(rows.map(r => r.primary_signal_id)), new Set(['signal.judgment']));
  } finally { db.close(); }
});
test('TP-IDB2-004 compiled rows retain full Source → Document → Unit → Family → Signal provenance', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    compileInterviewDocument(db, baseDoc('source.aipm-wiki','https://github.com/archlizheng/AIPM-Wiki','这项工作里哪些部分是你本人负责和决定的？'));
    const row:any = db.prepare(`SELECT s.grade,s.canonical_url,d.captured_at,u.provenance_key,q.question_family_id,f.primary_signal_id
      FROM interview_questions q
      JOIN interview_source_units u ON u.id=q.source_unit_id
      JOIN interview_source_documents d ON d.id=u.source_document_id
      JOIN interview_sources s ON s.id=d.source_id
      JOIN interview_question_families f ON f.id=q.question_family_id`).get();
    assert.equal(row.grade, 'B');
    assert.equal(row.question_family_id, 'qf.ownership');
    assert.equal(row.primary_signal_id, 'signal.ownership');
    assert.match(row.provenance_key, /^prov\./);
    assert.equal(row.captured_at, NOW);
  } finally { db.close(); }
});

test('TP-IDB2-005 C-grade questions remain observation-only instead of becoming canonical active knowledge', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    compileInterviewDocument(db, baseDoc('source.nowcoder','https://www.nowcoder.com/','项目中哪些能力是你本人主导的？'));
    const row:any = db.prepare('SELECT lifecycle FROM interview_questions').get();
    assert.equal(row.lifecycle, 'OBSERVATION_ONLY');
  } finally { db.close(); }
});
test('TP-IDB2-006 source snapshots may change while unit identity and compiled question stay idempotent', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    const first = baseDoc('source.aipm-wiki','https://github.com/archlizheng/AIPM-Wiki','为什么不用现成框架，而选择自己实现？','section-build-buy');
    compileInterviewDocument(db, first);
    compileInterviewDocument(db, { ...first, capturedAt: '2026-09-08T03:00:00.000Z', units: [{ locator:'section-build-buy', kind:'QUESTION', text:'为什么最终没有采用现成方案，而是自己实现？' }] });
    assert.equal(count(db, 'interview_source_documents'), 2);
    assert.equal(count(db, 'interview_source_units'), 1);
    assert.equal(count(db, 'interview_questions'), 1);
    const row:any = db.prepare('SELECT canonical_text FROM interview_questions').get();
    assert.match(row.canonical_text, /没有采用现成方案/);
  } finally { db.close(); }
});

test('TP-IDB2-007 non-question research units remain provenance material and do not manufacture questions', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    compileInterviewDocument(db, {
      sourceId:'source.feishu-hire', title:'structured interview method', canonicalUrl:'https://hire.feishu.cn/blog/goodinterview', capturedAt:NOW,
      units:[{ locator:'competency-first', kind:'RUBRIC', text:'岗位能力标签先于题目，后轮补充或复核前轮未关闭的风险。' }]
    });
    assert.equal(count(db, 'interview_source_units'), 1);
    assert.equal(count(db, 'interview_questions'), 0);
  } finally { db.close(); }
});

test('TP-IDB2-008 unclassified question stays source material instead of being forced into a wrong family', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    const result = compileInterviewDocument(db, baseDoc('source.tech-interview-handbook','https://github.com/yangshun/tech-interview-handbook','解释浏览器事件循环的执行顺序。'));
    assert.equal(result.units[0].status, 'UNCLASSIFIED');
    assert.equal(count(db, 'interview_source_units'), 1);
    assert.equal(count(db, 'interview_questions'), 0);
  } finally { db.close(); }
});
test('TP-IDB2-009 compiler updates FTS5 projection for compiled questions without duplicate rows', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    const doc = baseDoc('source.aipm-wiki','https://github.com/archlizheng/AIPM-Wiki','为什么不用现成框架，而选择自己实现？','fts-build-buy');
    compileInterviewDocument(db, doc);
    compileInterviewDocument(db, doc);
    const hits = db.prepare("SELECT item_id,family_id FROM interview_question_search WHERE interview_question_search MATCH '现成框架'").all() as any[];
    assert.equal(hits.length, 1);
    assert.equal(hits[0].family_id, 'qf.build-vs-buy');
  } finally { db.close(); }
});

test('TP-IDB2-010 registry refresh is metadata-idempotent and never creates questions by itself', () => {
  const db = openDatabase(':memory:');
  try {
    registerAuditedInterviewSources(db, NOW);
    registerAuditedInterviewSources(db, '2026-09-08T03:00:00.000Z');
    assert.equal(count(db, 'interview_sources'), 36);
    assert.equal(count(db, 'interview_source_documents'), 0);
    assert.equal(count(db, 'interview_questions'), 0);
    const row:any = db.prepare("SELECT updated_at FROM interview_sources WHERE id='source.feishu-hire'").get();
    assert.equal(row.updated_at, '2026-09-08T03:00:00.000Z');
  } finally { db.close(); }
});