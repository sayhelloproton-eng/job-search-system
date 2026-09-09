import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { registerFormalQuestionCorpusWave4 } from '../server/interview-formal-corpus-wave4.ts';
import { registerFormalQuestionCorpusP5 } from '../server/interview-formal-corpus-p5.ts';
import { registerFormalQuestionCorpusP5B } from '../server/interview-formal-corpus-p5b.ts';
import { registerFormalQuestionCorpusSocialGapV1 } from '../server/interview-formal-corpus-social-gap-v1.ts';
import { registerFormalQuestionCorpusSocialEnhancementV1 } from '../server/interview-formal-corpus-social-enhancement-v1.ts';
import { registerRetrievalGoldenCorpus, evaluateRetrievalGoldenSet } from '../server/interview-retrieval.ts';
import { registerInterviewKnowledgeTaxonomy, auditInterviewKnowledgeCoverage } from '../server/interview-knowledge-coverage.ts';

function ready(){
  const db=openDatabase(':memory:');
  const now='2026-09-10T00:00:00.000Z';
  registerFormalQuestionCorpusWave4(db,now);
  registerFormalQuestionCorpusP5(db,now);
  registerFormalQuestionCorpusP5B(db,now);
  registerFormalQuestionCorpusSocialGapV1(db,now);
  registerFormalQuestionCorpusSocialEnhancementV1(db,now);
  registerRetrievalGoldenCorpus(db,now);
  registerInterviewKnowledgeTaxonomy(db,now);
  return db;
}

test('public formal corpus preserves 42 base questions and 94 active knowledge questions',()=>{
  const db=ready();
  try{
    const formal=Number((db.prepare("SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-4].*'").get() as any).c);
    const total=Number((db.prepare("SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-8].*'").get() as any).c);
    assert.equal(formal,42);
    assert.equal(total,94);
  }finally{db.close();}
});

test('public retrieval golden set is explainable and uses demo evidence',()=>{
  const db=ready();
  try{
    const result=evaluateRetrievalGoldenSet(db);
    assert.equal(result.total,8);
    assert.equal(result.explanationCoverage,1);
    assert.ok(result.top1Hits>=7,JSON.stringify(result.rows));
    const refs:any[]=db.prepare("SELECT DISTINCT evidence_ref_id id FROM interview_question_evidence_links WHERE lifecycle='ACTIVE'").all() as any[];
    for(const row of refs)assert.match(row.id,/^ev\.demo\./);
  }finally{db.close();}
});

test('knowledge coverage is route-driven and contains no private project topic requirement',()=>{
  const db=ready();
  try{
    const result=auditInterviewKnowledgeCoverage(db,{routeId:'route.ai-agent-devtools'});
    assert.equal(result.formalCorpus.questions,42);
    const topics:any[]=db.prepare('SELECT id FROM interview_knowledge_topics').all() as any[];
    assert.equal(topics.some((row)=>String(row.id).startsWith('project.')),false);
  }finally{db.close();}
});
