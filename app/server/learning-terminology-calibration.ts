import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupLearningTerm } from './learning-terminology-runtime.ts';

const REPO_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const DATA_ROOT=resolve(REPO_ROOT,'app/server/data/learning/terminology');
const corpus=JSON.parse(readFileSync(resolve(DATA_ROOT,'terms-v1.json'),'utf8'));
const terms:any[]=corpus.items;
const byId=new Map(terms.map((term:any)=>[term.id,term]));
const OUTCOMES=new Set(['CONFIRMED','UPDATE_REQUIRED','DEPRECATED','ALIAS_CHANGE','RELATION_CHANGE']);
const WINDOWS:any={STABLE_CONCEPT:365,EVOLVING_STANDARD:30,FRAMEWORK_SPECIFIC:120,MARKET_TERM:30};

export const TERMINOLOGY_CALIBRATION_TOOL_CONTRACTS={
  'learning.record_term_candidate':{sideEffect:'RECORD_TERM_CANDIDATE',idempotentBy:'request_id',careerFactsMutable:false},
  'learning.list_term_candidates':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.audit_term_freshness':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.record_term_calibration':{sideEffect:'RECORD_CALIBRATION_EVIDENCE',idempotentBy:'request_id',careerFactsMutable:false},
} as const;

function calibrationError(code:string){ const error:any=new Error(code); error.code=code; return error; }
function normalizeName(value:string){ return String(value??'').trim().replace(/\s+/g,' ').toLowerCase(); }
function termView(term:any){ return {id:term.id,canonicalName:term.canonicalName,aliases:term.aliases??[],chains:term.chains??[],priority:term.strongestSourceBand,termClass:term.termClass}; }
function existingTerm(db:any,name:string){ try{return lookupLearningTerm(db,{term:name});}catch(error:any){ if(error?.code==='LEARNING_TERM_NOT_FOUND'||error?.message==='LEARNING_TERM_NOT_FOUND') return null; throw error; } }
function candidateView(db:any,row:any){
  const provenanceCount=Number((db.prepare(`SELECT COUNT(DISTINCT source_type || ':' || COALESCE(source_ref,'')) c
    FROM learning_term_candidate_events WHERE candidate_id=?`).get(row.id) as any).c);
  return {id:row.id,displayName:row.display_name,normalizedName:row.normalized_name,status:row.status,mentionCount:Number(row.mention_count),provenanceCount,firstSeenAt:row.first_seen_at,lastSeenAt:row.last_seen_at};
}

export function recordTermCandidate(db:any,input:{requestId:string;name:string;sourceType:string;sourceRef?:string;context:string},now=new Date().toISOString()){
  if(!String(input.requestId??'').trim()) throw calibrationError('CALIBRATION_REQUEST_ID_REQUIRED');
  const displayName=String(input.name??'').trim(), normalized=normalizeName(displayName);
  if(!normalized) throw calibrationError('TERM_CANDIDATE_NAME_REQUIRED');
  if(!String(input.sourceType??'').trim()) throw calibrationError('TERM_CANDIDATE_SOURCE_REQUIRED');
  if(!String(input.context??'').trim()) throw calibrationError('TERM_CANDIDATE_CONTEXT_REQUIRED');
  const known=existingTerm(db,displayName);
  if(known) return {classification:'EXISTING_TERM',term:known.term,candidate:null};
  const prior:any=db.prepare(`SELECT candidate_id,source_type,source_ref,context,response_json FROM learning_term_candidate_events WHERE request_id=?`).get(input.requestId);
  if(prior){
    const same=prior.source_type===input.sourceType&&(prior.source_ref??null)===(input.sourceRef??null)&&prior.context===input.context;
    if(!same) throw calibrationError('REQUEST_ID_OPERATION_MISMATCH');
    return JSON.parse(prior.response_json);
  }
  let candidate:any=db.prepare('SELECT * FROM learning_term_candidates WHERE normalized_name=?').get(normalized);
  const candidateId=candidate?.id??`term-candidate.${randomUUID()}`;
  db.exec('BEGIN;');
  try{
    if(!candidate){
      db.prepare(`INSERT INTO learning_term_candidates(id,normalized_name,display_name,status,mention_count,first_seen_at,last_seen_at)
        VALUES(?,?,?,'OPEN',0,?,?)`).run(candidateId,normalized,displayName,now,now);
      candidate=db.prepare('SELECT * FROM learning_term_candidates WHERE id=?').get(candidateId);
    }
    const priorSources=Number((db.prepare(`SELECT COUNT(DISTINCT source_type || ':' || COALESCE(source_ref,'')) c
      FROM learning_term_candidate_events WHERE candidate_id=?`).get(candidateId) as any).c);
    const sameSource=Boolean(db.prepare(`SELECT 1 FROM learning_term_candidate_events WHERE candidate_id=? AND source_type=? AND COALESCE(source_ref,'')=COALESCE(?,'') LIMIT 1`)
      .get(candidateId,input.sourceType,input.sourceRef??null));
    const mentionCount=Number(candidate.mention_count)+1, provenanceCount=priorSources+(sameSource?0:1);
    const status=provenanceCount>=2?'READY_FOR_CURATED_REVIEW':'OPEN';
    const eventId=`term-candidate-event.${randomUUID()}`;
    const candidateResult={id:candidateId,displayName:candidate.display_name,normalizedName:candidate.normalized_name,status,mentionCount,provenanceCount,firstSeenAt:candidate.first_seen_at,lastSeenAt:now};
    const response={classification:'CANDIDATE',candidate:candidateResult,eventId};
    db.prepare(`UPDATE learning_term_candidates SET mention_count=?,status=?,last_seen_at=? WHERE id=?`).run(mentionCount,status,now,candidateId);
    db.prepare(`INSERT INTO learning_term_candidate_events(id,request_id,candidate_id,source_type,source_ref,context,response_json,created_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(eventId,input.requestId,candidateId,input.sourceType,input.sourceRef??null,input.context,JSON.stringify(response),now);
    db.exec('COMMIT;'); return response;
  }catch(error){ try{db.exec('ROLLBACK;')}catch{} throw error; }
}

export function listTermCandidates(db:any,input:{status?:string;limit?:number}={}){
  const limit=Math.max(1,Math.min(100,Number(input.limit??20)));
  const rows:any[]=input.status
    ? db.prepare('SELECT * FROM learning_term_candidates WHERE status=? ORDER BY last_seen_at DESC,id LIMIT ?').all(input.status,limit) as any[]
    : db.prepare('SELECT * FROM learning_term_candidates ORDER BY CASE status WHEN \'READY_FOR_CURATED_REVIEW\' THEN 0 ELSE 1 END,last_seen_at DESC,id LIMIT ?').all(limit) as any[];
  return {count:rows.length,items:rows.map(row=>candidateView(db,row))};
}

function addDays(iso:string,days:number){ const date=new Date(iso); date.setUTCDate(date.getUTCDate()+days); return date.toISOString(); }
function baselineFor(db:any,term:any){
  const row:any=db.prepare(`SELECT reviewed_at FROM learning_term_calibration_events WHERE term_id=? ORDER BY reviewed_at DESC,id DESC LIMIT 1`).get(term.id);
  return row?.reviewed_at??`${corpus.generatedAt}T00:00:00.000Z`;
}
export function auditTermFreshness(db:any,input:{now?:string;term?:string;termClass?:string;limit?:number}={}){
  const now=input.now??new Date().toISOString();
  let selected=terms;
  if(input.term){
    const looked=lookupLearningTerm(db,{term:input.term});
    selected=[byId.get(looked.term.id)];
  }else if(input.termClass) selected=terms.filter((term:any)=>term.termClass===input.termClass);
  const items=selected.map((term:any)=>{
    const lastReviewedAt=baselineFor(db,term), windowDays=Number(WINDOWS[term.termClass]??365), dueAt=addDays(lastReviewedAt,windowDays);
    return {term:termView(term),lastReviewedAt,dueAt,windowDays,stale:new Date(now).getTime()>=new Date(dueAt).getTime()};
  }).sort((a:any,b:any)=>Number(b.stale)-Number(a.stale)||a.dueAt.localeCompare(b.dueAt)||a.term.canonicalName.localeCompare(b.term.canonicalName));
  const limit=Math.max(1,Math.min(200,Number(input.limit??50)));
  return {now,count:Math.min(items.length,limit),items:items.slice(0,limit)};
}

export function recordTermCalibration(db:any,input:{requestId:string;term:string;outcome:string;sourceRef:string;sourceVersion?:string;note:string},now=new Date().toISOString()){
  if(!String(input.requestId??'').trim()) throw calibrationError('CALIBRATION_REQUEST_ID_REQUIRED');
  if(!OUTCOMES.has(String(input.outcome))) throw calibrationError('CALIBRATION_OUTCOME_INVALID');
  if(!String(input.sourceRef??'').trim()) throw calibrationError('CALIBRATION_SOURCE_REQUIRED');
  if(!String(input.note??'').trim()) throw calibrationError('CALIBRATION_NOTE_REQUIRED');
  const looked=lookupLearningTerm(db,{term:input.term});
  const prior:any=db.prepare(`SELECT term_id,outcome,source_ref,source_version,note,response_json FROM learning_term_calibration_events WHERE request_id=?`).get(input.requestId);
  if(prior){
    const same=prior.term_id===looked.term.id&&prior.outcome===input.outcome&&prior.source_ref===input.sourceRef&&(prior.source_version??null)===(input.sourceVersion??null)&&prior.note===input.note;
    if(!same) throw calibrationError('REQUEST_ID_OPERATION_MISMATCH');
    return JSON.parse(prior.response_json);
  }
  const eventId=`term-calibration.${randomUUID()}`;
  const response={eventId,term:looked.term,outcome:input.outcome,sourceRef:input.sourceRef,sourceVersion:input.sourceVersion??null,note:input.note,reviewedAt:now};
  db.prepare(`INSERT INTO learning_term_calibration_events(id,request_id,term_id,outcome,source_ref,source_version,note,response_json,reviewed_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(eventId,input.requestId,looked.term.id,input.outcome,input.sourceRef,input.sourceVersion??null,input.note,JSON.stringify(response),now);
  return response;
}
