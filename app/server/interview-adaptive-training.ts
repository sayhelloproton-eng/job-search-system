import { randomUUID } from 'node:crypto';

type Candidate={
  targetType:string; targetId:string; score:number; reasons:Set<string>;
  suggestedAction:string; sources:Set<string>; dueAt?:string|null;
};

export const INTERVIEW_ADAPTIVE_TOOL_CONTRACTS={
  'interview.plan_training':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'interview.complete_review':{sideEffect:'UPDATE_REVIEW_AND_SCHEDULE_NEXT',idempotentBy:'request_id',careerFactsMutable:false},
} as const;

const severityWeight:Record<string,number>={HIGH:450,MEDIUM:280,LOW:140};
const statusWeight:Record<string,number>={REGRESSING:300,OPEN:160,IMPROVING:80,STABLE:20};
const trainingAction:Record<string,string>={
  A:'LIGHT_REVIEW',B:'EXPRESSION_DRILL',C:'EVIDENCE_DRILL',D:'LEARN_THEN_RETRY',E:'TRADEOFF_CHALLENGE',F:'RESUME_REVIEW'
};
const growthAction:Record<string,string>={WEAKNESS:'TARGETED_PRACTICE',KNOWLEDGE_GAP:'LEARN_THEN_RETRY',EXPRESSION_GAP:'EXPRESSION_DRILL'};

function upsert(map:Map<string,Candidate>,input:Omit<Candidate,'reasons'|'sources'> & {reasons:string[];sources:string[]}){
  const key=`${input.targetType}:${input.targetId}`;
  const current=map.get(key);
  if(!current){ map.set(key,{...input,reasons:new Set(input.reasons),sources:new Set(input.sources)}); return; }
  current.score+=input.score;
  input.reasons.forEach(x=>current.reasons.add(x)); input.sources.forEach(x=>current.sources.add(x));
  if(input.dueAt&&(!current.dueAt||input.dueAt<current.dueAt)) current.dueAt=input.dueAt;
  if(current.suggestedAction==='LIGHT_REVIEW'&&input.suggestedAction!=='LIGHT_REVIEW') current.suggestedAction=input.suggestedAction;
}
function daysOld(now:string,then:string){ return Math.max(0,(Date.parse(now)-Date.parse(then))/86400000); }
function band(score:number){ return score>=900?'P0':score>=450?'P1':'P2'; }
function executableQuestionFamily(db:any,familyId:string,routeId:string){
  const active=db.prepare(`SELECT 1 ok FROM interview_question_families f JOIN interview_questions q ON q.question_family_id=f.id
    WHERE f.id=? AND f.lifecycle='ACTIVE' AND q.lifecycle='ACTIVE' LIMIT 1`).get(familyId);
  if(!active) return false;
  const bound=Number((db.prepare("SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id=? AND lifecycle='ACTIVE'").get(familyId) as any).c);
  if(bound===0) return true;
  return Number((db.prepare("SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id=? AND route_id=? AND lifecycle='ACTIVE'").get(familyId,routeId) as any).c)>0;
}
function selectForMode(items:Candidate[],mode:string,limit:number){
  if(mode==='REVIEW') return items.filter(x=>x.sources.has('REVIEW_QUEUE')).slice(0,limit);
  if(mode==='WEAKNESS') return items.filter(x=>x.sources.has('GROWTH_PROFILE')||x.suggestedAction==='EXPRESSION_DRILL'||x.suggestedAction==='LEARN_THEN_RETRY'||x.suggestedAction==='TRADEOFF_CHALLENGE').slice(0,limit);
  if(mode==='JD') return items.filter(x=>x.sources.has('JD_FOCUS')).slice(0,limit);
  if(mode!=='MIXED') return items.slice(0,limit);
  const picked:Candidate[]=[]; const seen=new Set<string>();
  for(const source of ['REVIEW_QUEUE','GROWTH_PROFILE','JD_FOCUS','TRAINING_ACTION']){
    const item=items.find(x=>x.sources.has(source)&&!seen.has(`${x.targetType}:${x.targetId}`));
    if(item){picked.push(item);seen.add(`${item.targetType}:${item.targetId}`);}
  }
  for(const item of items){if(picked.length>=limit) break; const key=`${item.targetType}:${item.targetId}`; if(!seen.has(key)){picked.push(item);seen.add(key);}}
  return picked.slice(0,limit);
}

export function planAdaptiveTraining(db:any,input:{routeId:string;sceneId:string;jobId?:string;mode?:'AUTO'|'REVIEW'|'WEAKNESS'|'JD'|'MIXED';limit?:number},now=new Date().toISOString()){
  const limit=Math.max(1,Math.min(10,Number(input.limit??5)));
  const candidates=new Map<string,Candidate>();

  const reviews:any[]=db.prepare("SELECT q.*,s.route_id source_route FROM interview_review_queue q LEFT JOIN interview_sessions s ON s.id=q.source_session_id WHERE q.status='OPEN'").all() as any[];
  for(const row of reviews){
    const reasons=['OPEN_REVIEW']; let score=900+Number(row.priority??0);
    if(row.due_at&&row.due_at<=now){score+=250;reasons.push('OVERDUE_REVIEW');}
    else if(row.due_at) reasons.push('SCHEDULED_REVIEW');
    if(row.source_route===input.routeId){score+=60;reasons.push('ROUTE_MATCH');}
    upsert(candidates,{targetType:row.target_type,targetId:row.target_id,score,reasons,sources:['REVIEW_QUEUE'],suggestedAction:'REVIEW_AND_RETRY',dueAt:row.due_at});
  }
  const growth:any[]=db.prepare("SELECT * FROM interview_growth_items WHERE status!='RESOLVED'").all() as any[];
  for(const row of growth){
    let score=(severityWeight[row.severity]??100)+(statusWeight[row.status]??0);
    const reasons=[`SEVERITY_${row.severity}`,row.status];
    score+=Math.min(200,Number(row.occurrence_count??0)*20);
    if(Number(row.practice_count??0)<Number(row.occurrence_count??0)){score+=120;reasons.push('UNDER_PRACTICED');}
    const age=daysOld(now,row.last_seen_at);
    if(age>=7){score+=150;reasons.push('STALE_7D_PLUS');}
    else if(age>=3){score+=80;reasons.push('STALE_3D_PLUS');}
    const targetType=row.dimension_type==='QUESTION_FAMILY'?'QUESTION_FAMILY':row.dimension_type;
    const targetId=row.dimension_ref??row.stable_key;
    upsert(candidates,{targetType,targetId,score,reasons,sources:['GROWTH_PROFILE'],suggestedAction:growthAction[row.item_type]??'TARGETED_PRACTICE'});
  }
  const actions:any[]=db.prepare(`SELECT t.classification,t.next_action,t.target_ref,f.target_type,f.target_id,s.route_id source_route
    FROM interview_training_events t JOIN interview_feedback_events f ON f.id=t.feedback_event_id
    LEFT JOIN interview_sessions s ON s.id=t.session_id WHERE t.status='OPEN'`).all() as any[];
  for(const row of actions){
    const targetId=row.target_id??row.target_ref; if(!targetId) continue;
    const reasons=[`OPEN_TRAINING_ACTION_${row.classification}`]; let score=420;
    if(row.source_route===input.routeId){score+=60;reasons.push('ROUTE_MATCH');}
    upsert(candidates,{targetType:row.target_type??'GENERAL',targetId,score,reasons,sources:['TRAINING_ACTION'],suggestedAction:trainingAction[row.classification]??'TARGETED_PRACTICE'});
  }

  if(input.jobId){
    const focus:any[]=db.prepare(`SELECT question_family_id,weight FROM interview_job_focus
      WHERE job_id=? AND question_family_id IS NOT NULL AND (route_id IS NULL OR route_id=?) ORDER BY weight DESC`).all(input.jobId,input.routeId) as any[];
    for(const row of focus){
      upsert(candidates,{targetType:'QUESTION_FAMILY',targetId:row.question_family_id,score:500+Number(row.weight??0)*3,
        reasons:[`JD_FOCUS_${row.weight}`],sources:['JD_FOCUS'],suggestedAction:'TARGETED_PRACTICE'});
    }
  }
  const ranked=[...candidates.values()]
    .filter(item=>item.targetType!=='QUESTION_FAMILY'||executableQuestionFamily(db,item.targetId,input.routeId))
    .sort((a,b)=>b.score-a.score||`${a.targetType}:${a.targetId}`.localeCompare(`${b.targetType}:${b.targetId}`));
  const mode=input.mode??'AUTO';
  if(mode==='JD'&&!input.jobId) throw new Error('INTERVIEW_ADAPTIVE_JOB_REQUIRED');
  const sorted=selectForMode(ranked,mode,limit);
  return {
    routeId:input.routeId,sceneId:input.sceneId,jobId:input.jobId??null,mode,
    selectionPolicy:'overdue review > regression/high gap > open training action > JD focus > stale/under-practiced growth item',
    items:sorted.map(item=>({
      targetType:item.targetType,targetId:item.targetId,priorityBand:band(item.score),
      suggestedAction:item.suggestedAction,reasons:[...item.reasons],sources:[...item.sources],dueAt:item.dueAt??null
    }))
  };
}

function existingAdaptiveRequest(db:any,requestId:string,operation:string){
  const row:any=db.prepare('SELECT operation,status,response_json FROM interview_idempotency_requests WHERE request_id=?').get(requestId);
  if(!row) return null;
  if(row.operation!==operation) throw new Error('REQUEST_ID_OPERATION_MISMATCH');
  if(row.status!=='APPLIED'||!row.response_json) throw new Error('REQUEST_ID_STATE_UNRECOVERABLE');
  return JSON.parse(row.response_json);
}
function recordAdaptiveRequest(db:any,requestId:string,operation:string,sessionId:string|null,response:any,now:string){
  db.prepare(`INSERT INTO interview_idempotency_requests(request_id,operation,session_id,status,response_json,created_at,updated_at)
    VALUES(?,?,?,'APPLIED',?,?,?)`).run(requestId,operation,sessionId,JSON.stringify(response),now,now);
}
function addDays(iso:string,days:number){ return new Date(Date.parse(iso)+days*86400000).toISOString(); }

export function completeAdaptiveReview(db:any,input:{requestId:string;reviewId:string;outcome:'NEEDS_RETRY'|'IMPROVED'|'STABLE';sessionId?:string},now=new Date().toISOString()){
  const operation='interview.complete_review';
  const cached=existingAdaptiveRequest(db,input.requestId,operation); if(cached) return cached;
  const review:any=db.prepare("SELECT * FROM interview_review_queue WHERE id=? AND status='OPEN'").get(input.reviewId);
  if(!review) throw new Error('INTERVIEW_REVIEW_NOT_OPEN');
  const interval=input.outcome==='NEEDS_RETRY'?1:input.outcome==='IMPROVED'?3:7;
  const nextReviewId=`review.${randomUUID()}`;
  const nextDueAt=addDays(now,interval);
  const nextPriority=input.outcome==='STABLE'?Math.max(-100,Number(review.priority)-20):input.outcome==='IMPROVED'?Math.max(-100,Number(review.priority)-10):Number(review.priority);
  const response={reviewId:input.reviewId,status:'DONE',outcome:input.outcome,nextReviewId,nextDueAt,nextIntervalDays:interval};
  db.exec('BEGIN;');
  try{
    db.prepare("UPDATE interview_review_queue SET status='DONE',updated_at=? WHERE id=?").run(now,input.reviewId);
    db.prepare(`INSERT INTO interview_review_queue(id,target_type,target_id,reason,priority,due_at,status,source_session_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'OPEN',?,?,?)`).run(nextReviewId,review.target_type,review.target_id,`spaced:${input.outcome}:${review.reason}`,nextPriority,nextDueAt,input.sessionId??review.source_session_id??null,now,now);
    recordAdaptiveRequest(db,input.requestId,operation,input.sessionId??review.source_session_id??null,response,now);
    db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
