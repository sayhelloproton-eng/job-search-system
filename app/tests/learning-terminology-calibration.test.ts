import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { openDatabase } from '../server/db.ts';
import { executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';
import { TERMINOLOGY_CALIBRATION_TOOL_CONTRACTS } from '../server/learning-terminology-calibration.ts';

const ROOT=resolve(import.meta.dirname,'../..');
const TERM_FILE=resolve(ROOT,'docs/学习/术语学习系统/data/terms-v1.json');
function run(db:any,op:string,input:any={}){ return executeInterviewRuntimeCommand(db,{op,input}); }
function sha(path:string){ return createHash('sha256').update(readFileSync(path)).digest('hex'); }

test('TP-CAL-001 runtime exposes bounded calibration contracts',()=>{
  const db=openDatabase(':memory:'); try{
    const status:any=run(db,'status');
    assert.deepEqual(Object.keys(TERMINOLOGY_CALIBRATION_TOOL_CONTRACTS),['learning.record_term_candidate','learning.list_term_candidates','learning.audit_term_freshness','learning.record_term_calibration']);
    assert.ok(status.terminologyCalibrationOperations.includes('learning.audit_term_freshness'));
    assert.equal(TERMINOLOGY_CALIBRATION_TOOL_CONTRACTS['learning.record_term_candidate'].careerFactsMutable,false);
  } finally { db.close(); }
});

test('TP-CAL-002 known canonical or alias is not admitted as a new candidate',()=>{
  const db=openDatabase(':memory:'); try{
    const result:any=run(db,'learning.record_term_candidate',{requestId:'cand.known',name:'MCP',sourceType:'JD',sourceRef:'job-1',context:'MCP required'});
    assert.equal(result.classification,'EXISTING_TERM');
    assert.equal(result.term.canonicalName,'MCP');
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM learning_term_candidates').get() as any).c),0);
  } finally { db.close(); }
});
test('TP-CAL-003 unknown candidate accumulates provenance and becomes reviewable only after multi-source evidence',()=>{
  const db=openDatabase(':memory:'); try{
    const first:any=run(db,'learning.record_term_candidate',{requestId:'cand.new.1',name:'Agent Mesh',sourceType:'JD',sourceRef:'job-1',context:'Agent Mesh experience'});
    assert.equal(first.classification,'CANDIDATE');
    assert.equal(first.candidate.status,'OPEN');
    const second:any=run(db,'learning.record_term_candidate',{requestId:'cand.new.2',name:'agent mesh',sourceType:'INTERVIEW',sourceRef:'session-1',context:'interviewer asked Agent Mesh'});
    assert.equal(second.candidate.mentionCount,2);
    assert.equal(second.candidate.status,'READY_FOR_CURATED_REVIEW');
    const listed:any=run(db,'learning.list_term_candidates',{status:'READY_FOR_CURATED_REVIEW'});
    assert.equal(listed.count,1);
    assert.equal(listed.items[0].displayName,'Agent Mesh');
    assert.equal(listed.items[0].provenanceCount,2);
  } finally { db.close(); }
});

test('TP-CAL-004 candidate writes are request-id idempotent',()=>{
  const db=openDatabase(':memory:'); try{
    const input={requestId:'cand.idem',name:'New Runtime Primitive',sourceType:'MANUAL',sourceRef:'note-1',context:'explicit candidate'};
    const a:any=run(db,'learning.record_term_candidate',input);
    const b:any=run(db,'learning.record_term_candidate',input);
    assert.deepEqual(a,b);
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM learning_term_candidate_events').get() as any).c),1);
  } finally { db.close(); }
});

test('TP-CAL-005 freshness audit uses class windows and calibration resets the baseline',()=>{
  const db=openDatabase(':memory:'); try{
    const stale:any=run(db,'learning.audit_term_freshness',{now:'2028-01-01T00:00:00.000Z',term:'MCP'});
    assert.equal(stale.items[0].term.canonicalName,'MCP');
    assert.equal(stale.items[0].stale,true);
    const calibrated:any=run(db,'learning.record_term_calibration',{requestId:'cal.mcp.1',term:'MCP',outcome:'CONFIRMED',sourceRef:'https://modelcontextprotocol.io/spec',sourceVersion:'2028-01',note:'official spec checked'});
    const tenDaysLater=new Date(new Date(calibrated.reviewedAt).getTime()+10*24*60*60*1000).toISOString();
    const fresh:any=run(db,'learning.audit_term_freshness',{now:tenDaysLater,term:'MCP'});
    assert.equal(fresh.items[0].stale,false);
    assert.equal(fresh.items[0].lastReviewedAt,calibrated.reviewedAt);
  } finally { db.close(); }
});
test('TP-CAL-006 calibration is append-only evidence and never mutates static truth or personal progress',()=>{
  const db=openDatabase(':memory:'); try{
    run(db,'status');
    const beforeSha=sha(TERM_FILE);
    const beforeProgress=Number((db.prepare('SELECT COUNT(*) c FROM learning_term_progress').get() as any).c);
    const beforeEvidence=Number((db.prepare('SELECT COUNT(*) c FROM interview_evidence_refs').get() as any).c);
    const result:any=run(db,'learning.record_term_calibration',{requestId:'cal.rag.1',term:'RAG',outcome:'UPDATE_REQUIRED',sourceRef:'https://example.invalid/official-rag',sourceVersion:'v2',note:'definition needs source refresh'});
    assert.equal(result.term.canonicalName,'RAG');
    assert.equal(result.outcome,'UPDATE_REQUIRED');
    assert.equal(sha(TERM_FILE),beforeSha);
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM learning_term_progress').get() as any).c),beforeProgress);
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM interview_evidence_refs').get() as any).c),beforeEvidence);
    assert.throws(()=>db.prepare('UPDATE learning_term_calibration_events SET note=? WHERE id=?').run('x',result.eventId),/CALIBRATION_EVENT_APPEND_ONLY/);
  } finally { db.close(); }
});
