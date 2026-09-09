import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEducationRisk, classifyVerification, evaluateMatch } from '../server/domain.ts';

test('TP-DOM-001 blocked evidence never becomes CLOSED', () => {
  assert.equal(classifyVerification({ blocked: true, closedSignal: false }), 'BLOCKED');
});

test('TP-DOM-002/003/004 education risk levels', () => {
  assert.equal(classifyEducationRisk('本科 5年以上经验'), 'MEDIUM');
  assert.equal(classifyEducationRisk('统招本科 985/211优先且硬性要求'), 'HIGH');
  assert.equal(classifyEducationRisk('硕士及以上'), 'VERY_HIGH');
});

test('TP-DOM-005/006 deterministic scoring and EXCLUDE', () => {
  const terms = [
    { term: 'Agent', matchType: 'STRONG_BOOST', weight: 25, active: true },
    { term: '外包', matchType: 'EXCLUDE', weight: 0, active: true }
  ];
  assert.deepEqual(evaluateMatch('Agent 平台研发', terms).finalScore, 75);
  const excluded = evaluateMatch('Agent 外包岗位', terms);
  assert.equal(excluded.excluded, true);
  assert.equal(excluded.finalScore, 0);
});
