import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { ensureInterviewRuntimeReady, executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';
import { retrieveInterviewCandidates } from '../server/interview-retrieval.ts';

const NEW_FAMILIES=[
  'qf.agent-skill-lifecycle',
  'qf.agent-multi-agent-orchestration',
  'qf.agent-memory-strategy',
  'qf.prompt-engineering-eval',
];
const C=(db:any,sql:string,...args:any[])=>Number((db.prepare(sql).get(...args) as any).c);
function setup(){const db=openDatabase(':memory:');ensureInterviewRuntimeReady(db,'2026-09-09T12:20:00.000Z');return db;}

test('TP-SG1-001 targeted social-gap expansion adds 4 families / 8 questions and preserves frozen V1',()=>{
  const db=setup();try{
    assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-4].*'"),42);
    assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-7].*'"),90);
    assert.equal(C(db,"SELECT COUNT(DISTINCT question_family_id) c FROM interview_questions WHERE id LIKE 'fq7.%'"),4);
    assert.equal(C(db,`SELECT COUNT(*) c FROM interview_question_families WHERE id IN (${NEW_FAMILIES.map(()=>'?').join(',')})`,...NEW_FAMILIES),4);
  }finally{db.close();}
});
test('TP-SG1-002 every fq7 question has direct A provenance, one pressure variant and family scoring anchors',()=>{
  const db=setup();try{
    const rows=db.prepare(`SELECT q.id,s.grade,COUNT(DISTINCT v.id) variants,COUNT(DISTINCT a.id) anchors
      FROM interview_questions q
      JOIN interview_source_units u ON u.id=q.source_unit_id
      JOIN interview_source_documents d ON d.id=u.source_document_id
      JOIN interview_sources s ON s.id=d.source_id
      LEFT JOIN interview_question_variants v ON v.question_id=q.id AND v.lifecycle='ACTIVE'
      LEFT JOIN interview_scoring_anchors a ON a.question_family_id=q.question_family_id AND a.lifecycle='ACTIVE'
      WHERE q.id LIKE 'fq7.%' GROUP BY q.id,s.grade`).all() as any[];
    assert.equal(rows.length,8);
    assert.ok(rows.every(r=>r.grade==='A'&&Number(r.variants)===1&&Number(r.anchors)===2));
  }finally{db.close();}
});

test('TP-SG1-003 new families have the intended Topic links and A-grade source registry entries',()=>{
  const db=setup();try{
    const expected=[['qf.agent-skill-lifecycle','agent.skill'],['qf.agent-multi-agent-orchestration','agent.multi-agent'],['qf.agent-memory-strategy','agent.memory'],['qf.prompt-engineering-eval','agent.prompt-engineering']];
    for(const [family,topic] of expected) assert.equal(C(db,"SELECT COUNT(*) c FROM interview_family_topic_links WHERE question_family_id=? AND topic_id=? AND lifecycle='ACTIVE'",family,topic),1,`${family}→${topic}`);
    const sources=['source.anthropic-agent-skills','source.openai-agents-orchestration','source.openai-agents-sessions','source.anthropic-prompting'];
    for(const source of sources) assert.equal(C(db,"SELECT COUNT(*) c FROM interview_sources WHERE id=? AND grade='A' AND lifecycle='ACTIVE'",source),1,source);
  }finally{db.close();}
});
test('TP-SG1-004 route guard exposes the new Agent gaps only to intended routes',()=>{
  const db=setup();try{
    for(const family of NEW_FAMILIES){
      const ai=retrieveInterviewCandidates(db,{routeId:'route.ai-agent-devtools',preferredFamilyId:family,limit:5});
      assert.ok(ai.candidates.some((x:any)=>x.familyId===family),`AI route missing ${family}`);
    }
    const feSkill=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',preferredFamilyId:'qf.agent-skill-lifecycle',limit:5});
    assert.ok(feSkill.candidates.some((x:any)=>x.familyId==='qf.agent-skill-lifecycle'));
    for(const family of ['qf.agent-multi-agent-orchestration','qf.agent-memory-strategy','qf.prompt-engineering-eval']){
      const fe=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',preferredFamilyId:family,limit:5});
      assert.equal(fe.candidates.length,0,`FE route leaked ${family}`);
    }
  }finally{db.close();}
});

test('TP-SG1-005 retrieval can independently select Skill, Multi-Agent, Memory and Prompt families',()=>{
  const db=setup();try{
    const cases=[
      ['Skill progressive disclosure load instructions','qf.agent-skill-lifecycle'],
      ['multi agent handoff agents as tools orchestration','qf.agent-multi-agent-orchestration'],
      ['working memory long term memory session retention retrieval','qf.agent-memory-strategy'],
      ['prompt engineering examples constraints eval iterate version','qf.prompt-engineering-eval'],
    ];
    for(const [query,family] of cases){const top=retrieveInterviewCandidates(db,{routeId:'route.ai-agent-devtools',queryText:query,limit:5}).candidates;assert.ok(top.some((x:any)=>x.familyId===family),`${family}: ${JSON.stringify(top.map((x:any)=>x.familyId))}`);}
  }finally{db.close();}
});

test('TP-SG1-006 expansion does not invent candidate evidence links',()=>{
  const db=setup();try{
    assert.equal(C(db,`SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id IN (${NEW_FAMILIES.map(()=>'?').join(',')})`,...NEW_FAMILIES),0);
  }finally{db.close();}
});

test('TP-SG1-007 runtime readiness is idempotent after social-gap expansion',()=>{
  const db=setup();try{
    ensureInterviewRuntimeReady(db,'2026-09-09T12:25:00.000Z');
    assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id LIKE 'fq7.%'"),8);
    assert.equal(C(db,"SELECT COUNT(DISTINCT question_family_id) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id LIKE 'fq7.%'"),4);
  }finally{db.close();}
});

test('TP-SG1-008 runtime status preserves 42 frozen formal questions after later knowledge expansion',()=>{
  const db=setup();try{
    const status:any=executeInterviewRuntimeCommand(db,{op:'status'});
    assert.equal(status.formalQuestions,42);
    assert.equal(status.totalActiveQuestions,94);
    assert.equal(status.ready,true);
  }finally{db.close();}
});