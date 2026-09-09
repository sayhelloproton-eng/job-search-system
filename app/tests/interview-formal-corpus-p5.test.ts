import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { registerFormalQuestionCorpusP5 } from '../server/interview-formal-corpus-p5.ts';
import { registerInterviewKnowledgeTaxonomy, auditInterviewKnowledgeCoverage } from '../server/interview-knowledge-coverage.ts';
import { retrieveInterviewCandidates } from '../server/interview-retrieval.ts';

const now='2026-09-08T02:40:00.000Z';
const P5=[
  'qf.agent-mcp-tools','qf.agent-tool-calling-contract','qf.agent-workflow-boundary','qf.agent-rag-retrieval',
  'qf.backend-node-runtime','qf.backend-http-api','qf.backend-database-isolation','qf.backend-reliability-idempotency',
  'qf.frontend-react-rendering','qf.frontend-performance-measurement','qf.frontend-testing-strategy',
];
const count=(db:any,sql:string,...args:any[])=>Number((db.prepare(sql).get(...args) as any).c);
function setup(){ const db=openDatabase(':memory:'); registerFormalQuestionCorpusP5(db,now); registerInterviewKnowledgeTaxonomy(db,now); return db; }

test('TP-P5C-001 targeted expansion adds 11 families / 22 questions without changing frozen V1 count',()=>{
  const db=setup(); try {
    assert.equal(count(db,`SELECT COUNT(*) c FROM interview_question_families WHERE id IN (${P5.map(()=>'?').join(',')})`,...P5),11);
    assert.equal(count(db,"SELECT COUNT(*) c FROM interview_questions WHERE id LIKE 'fq5.%' AND lifecycle='ACTIVE'"),22);
    assert.equal(count(db,"SELECT COUNT(*) c FROM interview_questions WHERE id GLOB 'fq[1-4].*' AND lifecycle='ACTIVE'"),42);
    assert.equal(count(db,"SELECT COUNT(*) c FROM interview_questions WHERE id GLOB 'fq[1-5].*' AND lifecycle='ACTIVE'"),64);
  } finally { db.close(); }
});

test('TP-P5C-002 every new question has direct A-grade source provenance and one pressure variant',()=>{
  const db=setup(); try {
    const rows=db.prepare(`SELECT q.id,s.grade,COUNT(v.id) variants FROM interview_questions q JOIN interview_source_units u ON u.id=q.source_unit_id JOIN interview_source_documents d ON d.id=u.source_document_id JOIN interview_sources s ON s.id=d.source_id LEFT JOIN interview_question_variants v ON v.question_id=q.id AND v.lifecycle='ACTIVE' WHERE q.id LIKE 'fq5.%' GROUP BY q.id,s.grade`).all() as any[];
    assert.equal(rows.length,22); assert.ok(rows.every(r=>r.grade==='A')); assert.ok(rows.every(r=>Number(r.variants)===1));
  } finally { db.close(); }
});

test('TP-P5C-003 every new family maps to a Topic and has positive/negative scoring anchors',()=>{
  const db=setup(); try {
    for(const family of P5){
      assert.ok(count(db,"SELECT COUNT(*) c FROM interview_family_topic_links WHERE question_family_id=? AND lifecycle='ACTIVE'",family)>=1,`${family} topic`);
      const polarities=new Set((db.prepare("SELECT polarity FROM interview_scoring_anchors WHERE question_family_id=? AND lifecycle='ACTIVE'").all(family) as any[]).map(x=>x.polarity));
      assert.deepEqual(polarities,new Set(['POSITIVE','NEGATIVE']),family);
    }
  } finally { db.close(); }
});

test('TP-P5C-004 Topic Route expectations constrain new families without fake candidate Evidence links',()=>{
  const db=setup(); try {
    const ai=retrieveInterviewCandidates(db,{routeId:'route.ai-agent-devtools',queryText:'MCP tools schema human control',limit:10});
    assert.ok(ai.candidates.some((x:any)=>x.familyId==='qf.agent-mcp-tools'));
    const fe=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',queryText:'MCP tools schema human control',limit:20});
    assert.equal(fe.candidates.some((x:any)=>x.familyId==='qf.agent-mcp-tools'),false);
    const feReact=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',queryText:'React render commit memo performance',limit:10});
    assert.ok(feReact.candidates.some((x:any)=>x.familyId==='qf.frontend-react-rendering'));
    const aiReact=retrieveInterviewCandidates(db,{routeId:'route.ai-agent-devtools',queryText:'React render commit memo performance',limit:20});
    assert.equal(aiReact.candidates.some((x:any)=>x.familyId==='qf.frontend-react-rendering'),false);
    assert.equal(count(db,"SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id IN ('qf.agent-mcp-tools','qf.frontend-react-rendering')"),0);
  } finally { db.close(); }
});

test('TP-P5C-005 expansion closes selected machine-audited gaps instead of merely increasing question count',()=>{
  const db=setup(); try {
    const ai=auditInterviewKnowledgeCoverage(db,{routeId:'route.ai-agent-devtools'},now);
    const agent=ai.domains.find((x:any)=>x.domainId==='agent-ai'); const backend=ai.domains.find((x:any)=>x.domainId==='backend-fullstack');
    assert.equal(agent.coveredTopics,9); assert.equal(backend.coveredTopics,3);
    const fe=auditInterviewKnowledgeCoverage(db,{routeId:'route.advanced-fe-fullstack'},now);
    const front=fe.domains.find((x:any)=>x.domainId==='frontend'); assert.equal(front.coveredTopics,7);
    const fde=auditInterviewKnowledgeCoverage(db,{routeId:'route.tob-fde'},now);
    const fdeAgent=fde.domains.find((x:any)=>x.domainId==='agent-ai'); assert.equal(fdeAgent.coveredTopics,4);
  } finally { db.close(); }
});

test('TP-P5C-006 registration is idempotent and expanded retrieval stays explainable',()=>{
  const db=setup(); try {
    registerFormalQuestionCorpusP5(db,'2026-09-08T03:00:00.000Z'); registerInterviewKnowledgeTaxonomy(db,'2026-09-08T03:00:00.000Z');
    assert.equal(count(db,"SELECT COUNT(*) c FROM interview_questions WHERE id LIKE 'fq5.%'"),22);
    const top=retrieveInterviewCandidates(db,{routeId:'route.advanced-fe-fullstack',queryText:'HTTP idempotent retry POST API',limit:1}).candidates[0];
    assert.equal(top?.familyId,'qf.backend-http-api'); assert.ok(top?.reasons?.includes('FTS'));
  } finally { db.close(); }
});
