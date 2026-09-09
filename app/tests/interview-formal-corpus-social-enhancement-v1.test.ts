import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { ensureInterviewRuntimeReady, executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';
import { retrieveInterviewCandidates } from '../server/interview-retrieval.ts';
import { auditInterviewKnowledgeCoverage } from '../server/interview-knowledge-coverage.ts';

const C=(db:any,sql:string,...args:any[])=>Number((db.prepare(sql).get(...args) as any).c);
function setup(){const db=openDatabase(':memory:');ensureInterviewRuntimeReady(db,'2026-09-09T14:45:00.000Z');return db;}
const FQ8=['fq8.agent-runtime-loop.01','fq8.rag-query-rank.01','fq8.rag-graphrag.01','fq8.backend-streaming.01'];
const OWNERS=['qf.agent-runtime-recovery','qf.agent-rag-retrieval','qf.backend-http-api'];

test('TP-SE1-001 fq8 adds 4 questions to existing families and preserves frozen counts',()=>{const db=setup();try{
  assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-4].*'"),42);
  assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-8].*'"),94);
  assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id LIKE 'fq8.%'"),4);
  assert.equal(C(db,"SELECT COUNT(DISTINCT question_family_id) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-8].*'"),45);
}finally{db.close();}});

test('TP-SE1-002 every fq8 question has direct A provenance and one pressure variant',()=>{const db=setup();try{
  const rows=db.prepare(`SELECT q.id,s.grade,COUNT(DISTINCT v.id) variants FROM interview_questions q JOIN interview_source_units u ON u.id=q.source_unit_id JOIN interview_source_documents d ON d.id=u.source_document_id JOIN interview_sources s ON s.id=d.source_id LEFT JOIN interview_question_variants v ON v.question_id=q.id AND v.lifecycle='ACTIVE' WHERE q.id LIKE 'fq8.%' GROUP BY q.id,s.grade`).all() as any[];
  assert.equal(rows.length,4);assert.ok(rows.every(r=>r.grade==='A'&&Number(r.variants)===1));
}finally{db.close();}});

test('TP-SE1-003 fq8 reuses exactly three existing families and adds no family',()=>{const db=setup();try{
  const rows=db.prepare("SELECT DISTINCT question_family_id id FROM interview_questions WHERE id LIKE 'fq8.%' ORDER BY id").all() as any[];
  assert.deepEqual(rows.map(x=>x.id),[...OWNERS].sort());
  assert.equal(C(db,"SELECT COUNT(*) c FROM interview_question_families WHERE lifecycle='ACTIVE'"),49);
}finally{db.close();}});

test('TP-SE1-004 route guard keeps fq8 inside existing family route eligibility',()=>{const db=setup();try{
  for(const family of ['qf.agent-runtime-recovery','qf.agent-rag-retrieval']){
    const ai=retrieveInterviewCandidates(db,{routeId:'route.ai-agent-devtools',preferredFamilyId:family,limit:10});assert.ok(ai.candidates.some((x:any)=>x.familyId===family),family);
  }
  const fe=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',preferredFamilyId:'qf.backend-http-api',limit:10});assert.ok(fe.candidates.some((x:any)=>x.familyId==='qf.backend-http-api'));
  const feRag=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',preferredFamilyId:'qf.agent-rag-retrieval',limit:10});assert.equal(feRag.candidates.length,0);
}finally{db.close();}});

test('TP-SE1-005 retrieval can independently reach all four fq8 questions',()=>{const db=setup();try{
  const cases=[['max turns agent loop hard stop cancellation','fq8.agent-runtime-loop.01'],['rewrite query ranking options rerank vector search','fq8.rag-query-rank.01'],['GraphRAG local global drift basic search knowledge graph','fq8.rag-graphrag.01'],['SSE EventSource unidirectional WebSocket bidirectional streaming','fq8.backend-streaming.01']];
  for(const [query,id] of cases){const top=retrieveInterviewCandidates(db,{routeId:id.includes('backend')?'route.advanced-fe-fullstack':'route.ai-agent-devtools',queryText:query,limit:10}).candidates;assert.ok(top.some((x:any)=>x.questionId===id),`${id}: ${JSON.stringify(top.map((x:any)=>x.questionId))}`);}
}finally{db.close();}});

test('TP-SE1-006 fq8 creates no candidate evidence and no new scoring anchor',()=>{const db=setup();try{
  assert.equal(C(db,"SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id IN (?,?,?)",...OWNERS),C(db,"SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id IN (?,?,?) AND question_family_id IN (SELECT question_family_id FROM interview_questions WHERE id NOT LIKE 'fq8.%')",...OWNERS));
  assert.equal(C(db,"SELECT COUNT(*) c FROM interview_scoring_anchors WHERE id LIKE 'anchor.fq8.%'"),0);
}finally{db.close();}});

test('TP-SE1-007 runtime readiness remains idempotent after fq8',()=>{const db=setup();try{ensureInterviewRuntimeReady(db,'2026-09-09T14:50:00.000Z');assert.equal(C(db,"SELECT COUNT(*) c FROM interview_questions WHERE id LIKE 'fq8.%'"),4);}finally{db.close();}});

test('TP-SE1-008 runtime and knowledge coverage both see 94 questions with zero CORE gaps',()=>{const db=setup();try{
  const status:any=executeInterviewRuntimeCommand(db,{op:'status'});assert.equal(status.formalQuestions,42);assert.equal(status.totalActiveQuestions,94);assert.equal(status.ready,true);
  const audit:any=auditInterviewKnowledgeCoverage(db,{routeId:'route.ai-agent-devtools'});assert.equal(audit.knowledgeCorpus.questions,94);assert.equal(audit.domains.flatMap((d:any)=>d.missingTopics).filter((x:any)=>x.expectation==='CORE').length,0);
}finally{db.close();}});
