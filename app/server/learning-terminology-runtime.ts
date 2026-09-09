import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const DATA_ROOT=resolve(REPO_ROOT,'app/server/data/learning/terminology');
const corpus=JSON.parse(readFileSync(resolve(DATA_ROOT,'terms-v1.json'),'utf8'));
const aliases=JSON.parse(readFileSync(resolve(DATA_ROOT,'aliases-v1.json'),'utf8'));
const graph=JSON.parse(readFileSync(resolve(DATA_ROOT,'term-graph-v1.json'),'utf8'));
const termCards=JSON.parse(readFileSync(resolve(DATA_ROOT,'term-cards-v1.json'),'utf8'));
const cardSources=JSON.parse(readFileSync(resolve(DATA_ROOT,'term-card-sources-v1.json'),'utf8'));

const STATES=['UNSEEN','RECOGNIZE','EXPLAIN','CONNECT','APPLY','DEBUG','DESIGN','INTERVIEW_READY'] as const;
const stateSet=new Set<string>(STATES);
const terms:any[]=corpus.items;
const byId=new Map(terms.map((term:any)=>[term.id,term]));
const byName=new Map(terms.map((term:any)=>[term.canonicalName.toLowerCase(),term]));
const aliasToCanonical=new Map<string,string>();
for(const row of aliases.aliases) aliasToCanonical.set(String(row.alias).toLowerCase(),String(row.canonical));
const cardByTermId=new Map<string,any>((termCards.items??[]).map((card:any)=>[card.termId,card]));
const sourceById=new Map<string,any>((cardSources.sources??[]).map((source:any)=>[source.id,source]));

export const TERMINOLOGY_LEARNING_TOOL_CONTRACTS={
  'learning.term_lookup':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.search_terms':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.plan_term_path':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.record_term_progress':{sideEffect:'RECORD_LEARNING_PROGRESS',idempotentBy:'request_id',careerFactsMutable:false},
  'learning.get_term_progress':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.list_due_reviews':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.get_term_card_coverage':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

function learningError(code:string){ const error:any=new Error(code); error.code=code; return error; }
function termView(term:any){
  return {id:term.id,canonicalName:term.canonicalName,aliases:term.aliases??[],chains:term.chains??[],priority:term.strongestSourceBand,termClass:term.termClass};
}
function cardView(termId:string){
  const card:any=cardByTermId.get(termId);
  if(!card) return null;
  return {...card,sources:(card.sourceRefs??[]).map((id:string)=>sourceById.get(id)).filter(Boolean)};
}
function resolveTerm(value:string){
  const key=String(value??'').trim().toLowerCase();
  if(!key) throw learningError('LEARNING_TERM_NOT_FOUND');
  const direct=byName.get(key); if(direct) return direct;
  const canonical=aliasToCanonical.get(key); if(canonical){
    const resolved=byName.get(canonical.toLowerCase()); if(resolved) return resolved;
  }
  throw learningError('LEARNING_TERM_NOT_FOUND');
}

function currentProgress(db:any,termId:string){
  const row:any=db.prepare(`SELECT term_id,state,confidence,source_type,source_ref,next_review_at,updated_at
    FROM learning_term_progress WHERE term_id=?`).get(termId);
  return row?{termId:row.term_id,state:row.state,confidence:row.confidence,sourceType:row.source_type,sourceRef:row.source_ref,nextReviewAt:row.next_review_at,updatedAt:row.updated_at}
    :{termId,state:'UNSEEN',confidence:0,sourceType:null,sourceRef:null,nextReviewAt:null,updatedAt:null};
}

function neighborsFor(termId:string){
  const out:any[]=[];
  for(const edge of graph.edges){
    if(edge.from===termId){ const term=byId.get(edge.to); if(term) out.push({type:edge.type,direction:'OUT',term:termView(term)}); }
    else if(edge.to===termId){ const term=byId.get(edge.from); if(term) out.push({type:edge.type,direction:'IN',term:termView(term)}); }
  }
  return out;
}

export function lookupLearningTerm(db:any,input:{term:string}){
  const term=resolveTerm(input.term);
  return {term:termView(term),card:cardView(term.id),neighbors:neighborsFor(term.id),progress:currentProgress(db,term.id)};
}

export function searchLearningTerms(_db:any,input:{query:string;limit?:number}){
  const q=String(input.query??'').trim().toLowerCase();
  if(!q) return {count:0,items:[]};
  const limit=Math.max(1,Math.min(50,Number(input.limit??20)));
  const hits=terms.filter((term:any)=>term.canonicalName.toLowerCase().includes(q)||(term.aliases??[]).some((a:string)=>a.toLowerCase().includes(q))||[...(aliasToCanonical.entries())].some(([a,c])=>a.includes(q)&&c.toLowerCase()===term.canonicalName.toLowerCase()));
  return {count:Math.min(hits.length,limit),items:hits.slice(0,limit).map(termView)};
}
const DEFAULT_PATH_TYPES=new Set(['PREREQUISITE_OF','PART_OF','USES','PROVIDES','IMPLEMENTED_BY','CROSS_CHAIN','OBSERVED_BY','ALTERNATIVE_TO']);
function bfsPath(fromId:string,toId:string,allowedIds?:Set<string>){
  const queue=[fromId], prev=new Map<string,string|null>([[fromId,null]]);
  while(queue.length){
    const cur=queue.shift()!; if(cur===toId) break;
    for(const edge of graph.edges){
      if(!DEFAULT_PATH_TYPES.has(edge.type)) continue;
      let next:string|null=null;
      if(edge.from===cur) next=edge.to; else if(edge.to===cur) next=edge.from;
      if(!next||prev.has(next)||(allowedIds&&!allowedIds.has(next))) continue;
      prev.set(next,cur); queue.push(next);
    }
  }
  if(!prev.has(toId)) return [];
  const ids:string[]=[]; for(let cur:string|null=toId;cur;cur=prev.get(cur)??null) ids.push(cur);
  return ids.reverse().map(id=>termView(byId.get(id)));
}

function prerequisitePlan(targetId:string){
  const dependencyTypes=new Set(['PREREQUISITE_OF','PART_OF','USES']);
  const seen=new Map<string,number>([[targetId,0]]), queue=[targetId];
  while(queue.length){
    const cur=queue.shift()!, depth=seen.get(cur)!; if(depth>=6) continue;
    for(const edge of graph.edges){
      if(!dependencyTypes.has(edge.type)||edge.to!==cur||seen.has(edge.from)) continue;
      seen.set(edge.from,depth+1); queue.push(edge.from);
    }
  }
  return [...seen.entries()].sort((a,b)=>b[1]-a[1]||String(byId.get(a[0])?.canonicalName).localeCompare(String(byId.get(b[0])?.canonicalName)))
    .map(([id])=>termView(byId.get(id)));
}

export function planLearningTermPath(_db:any,input:{mode:'PREREQUISITE'|'BETWEEN'|'CHAIN';target:string;from?:string;chain?:string}){
  const mode=String(input.mode??'');
  if(!['PREREQUISITE','BETWEEN','CHAIN'].includes(mode)) throw learningError('LEARNING_PATH_MODE_INVALID');
  const target=resolveTerm(input.target);
  if(mode==='PREREQUISITE') return {mode,target:termView(target),path:prerequisitePlan(target.id)};
  const rootName=mode==='CHAIN'?(input.from??({agent:'Transformer',frontend:'Browser',backend:'Server',fullstack:'Client',shared:'Client'} as any)[String(input.chain)]):input.from;
  if(!rootName) throw learningError('LEARNING_PATH_FROM_REQUIRED');
  const from=resolveTerm(rootName);
  let allowed: Set<string>|undefined;
  if(mode==='CHAIN'){
    const chain=String(input.chain??''); if(!['agent','frontend','backend','fullstack','shared'].includes(chain)) throw learningError('LEARNING_CHAIN_INVALID');
    allowed=new Set(terms.filter((t:any)=>(t.chains??[]).includes(chain)||(t.chains??[]).includes('shared')).map((t:any)=>t.id));
    allowed.add(from.id); allowed.add(target.id);
  }
  const path=bfsPath(from.id,target.id,allowed); if(!path.length) throw learningError('LEARNING_PATH_NOT_FOUND');
  return {mode,from:termView(from),target:termView(target),chain:input.chain??null,path};
}
export function recordLearningTermProgress(db:any,input:{requestId:string;term:string;state:string;confidence?:number;note:string;sourceType:string;sourceRef?:string;nextReviewAt?:string|null},now=new Date().toISOString()){
  const term=resolveTerm(input.term), state=String(input.state??'');
  if(!stateSet.has(state)) throw learningError('LEARNING_STATE_INVALID');
  const confidence=Number(input.confidence??0); if(!Number.isFinite(confidence)||confidence<0||confidence>1) throw learningError('LEARNING_CONFIDENCE_INVALID');
  if(!String(input.requestId??'').trim()) throw learningError('LEARNING_REQUEST_ID_REQUIRED');
  if(!String(input.note??'').trim()) throw learningError('LEARNING_PROGRESS_NOTE_REQUIRED');
  if(!String(input.sourceType??'').trim()) throw learningError('LEARNING_PROGRESS_SOURCE_REQUIRED');
  const existing:any=db.prepare(`SELECT term_id,to_state,confidence,note,source_type,source_ref,next_review_at,response_json
    FROM learning_term_progress_events WHERE request_id=?`).get(input.requestId);
  if(existing){
    const same=existing.term_id===term.id&&existing.to_state===state&&Number(existing.confidence)===confidence&&existing.note===input.note&&existing.source_type===input.sourceType&&(existing.source_ref??null)===(input.sourceRef??null)&&(existing.next_review_at??null)===(input.nextReviewAt??null);
    if(!same) throw learningError('REQUEST_ID_OPERATION_MISMATCH');
    return JSON.parse(existing.response_json);
  }
  const before=currentProgress(db,term.id), eventId=`term-progress.${randomUUID()}`;
  const current={termId:term.id,state,confidence,sourceType:input.sourceType,sourceRef:input.sourceRef??null,nextReviewAt:input.nextReviewAt??null,updatedAt:now};
  const response={term:termView(term),previousState:before.state,current,eventId};
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO learning_term_progress_events(id,request_id,term_id,from_state,to_state,confidence,note,source_type,source_ref,next_review_at,response_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(eventId,input.requestId,term.id,before.state,state,confidence,input.note,input.sourceType,input.sourceRef??null,input.nextReviewAt??null,JSON.stringify(response),now);
    db.prepare(`INSERT INTO learning_term_progress(term_id,state,confidence,source_type,source_ref,next_review_at,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(term_id) DO UPDATE SET state=excluded.state,confidence=excluded.confidence,source_type=excluded.source_type,source_ref=excluded.source_ref,next_review_at=excluded.next_review_at,updated_at=excluded.updated_at`)
      .run(term.id,state,confidence,input.sourceType,input.sourceRef??null,input.nextReviewAt??null,now);
    db.exec('COMMIT;'); return response;
  }catch(error){ try{db.exec('ROLLBACK;')}catch{} throw error; }
}

export function getLearningTermProgress(db:any,input:{term:string;historyLimit?:number}){
  const term=resolveTerm(input.term), limit=Math.max(1,Math.min(100,Number(input.historyLimit??20)));
  const history:any[]=db.prepare(`SELECT id,request_id,from_state,to_state,confidence,note,source_type,source_ref,next_review_at,created_at
    FROM learning_term_progress_events WHERE term_id=? ORDER BY created_at DESC,id DESC LIMIT ?`).all(term.id,limit) as any[];
  return {term:termView(term),current:currentProgress(db,term.id),history:history.map(row=>({eventId:row.id,requestId:row.request_id,fromState:row.from_state,toState:row.to_state,confidence:row.confidence,note:row.note,sourceType:row.source_type,sourceRef:row.source_ref,nextReviewAt:row.next_review_at,createdAt:row.created_at}))};
}
export function listLearningDueReviews(db:any,input:{now?:string;limit?:number}={}){
  const now=input.now??new Date().toISOString(), limit=Math.max(1,Math.min(100,Number(input.limit??20)));
  const rows:any[]=db.prepare(`SELECT term_id,state,confidence,source_type,source_ref,next_review_at,updated_at
    FROM learning_term_progress WHERE next_review_at IS NOT NULL AND next_review_at<=?
    ORDER BY next_review_at,term_id LIMIT ?`).all(now,limit) as any[];
  return {now,count:rows.length,items:rows.map(row=>({term:termView(byId.get(row.term_id)),progress:{termId:row.term_id,state:row.state,confidence:row.confidence,sourceType:row.source_type,sourceRef:row.source_ref,nextReviewAt:row.next_review_at,updatedAt:row.updated_at}}))};
}

export function getTermCardCoverage(){
  const materializedTerms=cardByTermId.size;
  const canonicalTargetTerms=Number(termCards.canonicalTargetTerms??terms.length);
  const hubTargetTerms=Number(termCards.hubTargetTerms??graph.hubNodeCount??0);
  const hubIds=new Set<string>(); for(const edge of graph.edges){ hubIds.add(edge.from); hubIds.add(edge.to); }
  const materializedHubTerms=Number(termCards.materializedHubTerms??[...hubIds].filter((id)=>cardByTermId.has(id)).length);
  const interviewCoreTargetTerms=Number(termCards.interviewCoreTarget??103);
  const interviewCoreMaterializedTerms=Number(termCards.interviewCoreMaterialized??Math.min(interviewCoreTargetTerms,materializedTerms));
  return {schemaVersion:termCards.schemaVersion,coverageScope:termCards.coverageScope,
    interviewCoreTargetTerms,interviewCoreMaterializedTerms,interviewCoreCoverageRatio:interviewCoreTargetTerms?interviewCoreMaterializedTerms/interviewCoreTargetTerms:0,
    hubTargetTerms,materializedHubTerms,hubMissingTerms:Math.max(0,hubTargetTerms-materializedHubTerms),hubCoverageRatio:hubTargetTerms?materializedHubTerms/hubTargetTerms:0,
    canonicalTargetTerms,materializedTerms,canonicalCoverageRatio:canonicalTargetTerms?materializedTerms/canonicalTargetTerms:0,sourceCount:sourceById.size};
}

export function getTerminologyLearningStatus(){
  return {schemaVersion:corpus.schemaVersion,canonicalTerms:terms.length,graphVersion:graph.schemaVersion,hubNodes:graph.hubNodeCount,edges:graph.edgeCount,termCardCoverage:getTermCardCoverage(),states:[...STATES]};
}