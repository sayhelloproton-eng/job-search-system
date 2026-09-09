import { randomUUID } from 'node:crypto';

type Verdict='PASS'|'PARTIAL'|'FAIL'|'UNSCORED';
type VersionKind='ORIGINAL'|'REVIEWED'|'IMPROVED'|'LATER_PRACTICE';
type GrowthItemType='WEAKNESS'|'KNOWLEDGE_GAP'|'EXPRESSION_GAP';
type DimensionType='QUESTION_FAMILY'|'SIGNAL'|'TOPIC'|'PROJECT'|'EXPRESSION'|'GENERAL';
type ObservationType='OCCURRENCE'|'PRACTICE'|'IMPROVEMENT'|'REGRESSION'|'RESOLUTION'|'NOTE';

export const INTERVIEW_GROWTH_TOOL_CONTRACTS={
  'interview.record_round_debrief':{sideEffect:'APPEND_ROUND_DEBRIEF',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.append_answer_version':{sideEffect:'APPEND_ANSWER_VERSION',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.record_growth_observation':{sideEffect:'UPSERT_GROWTH_ITEM_APPEND_OBSERVATION',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.select_best_answer':{sideEffect:'SELECT_CURRENT_BEST_ANSWER',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.enqueue_review':{sideEffect:'APPEND_REVIEW_ITEM',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.get_growth_profile':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

function existingRequest(db:any,requestId:string,operation:string){
  const row:any=db.prepare('SELECT operation,status,response_json FROM interview_idempotency_requests WHERE request_id=?').get(requestId);
  if(!row) return null;
  if(row.operation!==operation) throw new Error('REQUEST_ID_OPERATION_MISMATCH');
  if(row.status!=='APPLIED'||!row.response_json) throw new Error('REQUEST_ID_STATE_UNRECOVERABLE');
  return JSON.parse(row.response_json);
}
function recordRequest(db:any,requestId:string,operation:string,sessionId:string|null,response:any,now:string){
  db.prepare(`INSERT INTO interview_idempotency_requests(request_id,operation,session_id,status,response_json,created_at,updated_at)
    VALUES(?,?,?,'APPLIED',?,?,?)`).run(requestId,operation,sessionId,JSON.stringify(response),now,now);
}
function ensureSession(db:any,sessionId:string){
  const row:any=db.prepare('SELECT id,status,route_id,scene_id FROM interview_sessions WHERE id=?').get(sessionId);
  if(!row) throw new Error('INTERVIEW_SESSION_NOT_FOUND');
  return row;
}
const json=(value:any)=>JSON.stringify(value??[]);

export function recordRoundDebrief(db:any,input:{requestId:string;sessionId:string;verdict:Verdict;scoreValue?:number;scoreReason:string;strengths?:any[];weaknesses?:any[];interviewerIntents?:any[];sentenceCritiques?:any[];replacementExamples?:any[];knowledgeGaps?:any[];expressionGaps?:any[];nextTrainingPlan?:any[]},now=new Date().toISOString()){
  const operation='interview.record_round_debrief';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  ensureSession(db,input.sessionId);
  for(const [key,value] of Object.entries({strengths:input.strengths,weaknesses:input.weaknesses,interviewerIntents:input.interviewerIntents,sentenceCritiques:input.sentenceCritiques,replacementExamples:input.replacementExamples,knowledgeGaps:input.knowledgeGaps,expressionGaps:input.expressionGaps,nextTrainingPlan:input.nextTrainingPlan})){
    if(!Array.isArray(value)) throw new Error(`INTERVIEW_DEBRIEF_${key.toUpperCase()}_REQUIRED`);
  }
  const revision=Number((db.prepare('SELECT COALESCE(MAX(revision),0)+1 r FROM interview_round_debriefs WHERE session_id=?').get(input.sessionId) as any).r);
  const debriefId=`debrief.${randomUUID()}`;
  const response={debriefId,sessionId:input.sessionId,revision,verdict:input.verdict,scoreValue:input.scoreValue??null};
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO interview_round_debriefs(id,session_id,revision,verdict,score_value,score_reason,strengths_json,weaknesses_json,interviewer_intent_json,sentence_critiques_json,replacement_examples_json,knowledge_gaps_json,expression_gaps_json,next_training_plan_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(debriefId,input.sessionId,revision,input.verdict,input.scoreValue??null,input.scoreReason,json(input.strengths),json(input.weaknesses),json(input.interviewerIntents),json(input.sentenceCritiques),json(input.replacementExamples),json(input.knowledgeGaps),json(input.expressionGaps),json(input.nextTrainingPlan),now);
    recordRequest(db,input.requestId,operation,input.sessionId,response,now); db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
export function appendAnswerVersion(db:any,input:{requestId:string;sessionId:string;turnId?:string;questionFamilyId?:string;parentVersionId?:string;versionKind:VersionKind;content:string;critiqueSummary?:string},now=new Date().toISOString()){
  const operation='interview.append_answer_version';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  ensureSession(db,input.sessionId);
  if(!String(input.content??'').trim()) throw new Error('INTERVIEW_ANSWER_CONTENT_REQUIRED');
  if(input.turnId){
    const turn=db.prepare('SELECT id,question_family_id FROM interview_turns WHERE id=? AND session_id=?').get(input.turnId,input.sessionId) as any;
    if(!turn) throw new Error('INTERVIEW_TURN_NOT_FOUND');
    if(input.questionFamilyId&&turn.question_family_id&&input.questionFamilyId!==turn.question_family_id) throw new Error('INTERVIEW_ANSWER_FAMILY_MISMATCH');
  }
  if(input.parentVersionId){
    const parent:any=db.prepare('SELECT question_family_id FROM interview_answer_versions WHERE id=?').get(input.parentVersionId);
    if(!parent) throw new Error('INTERVIEW_PARENT_ANSWER_VERSION_NOT_FOUND');
    if(parent.question_family_id&&input.questionFamilyId&&parent.question_family_id!==input.questionFamilyId) throw new Error('INTERVIEW_ANSWER_LINEAGE_FAMILY_MISMATCH');
  }
  const answerVersionId=`answer.${randomUUID()}`;
  const response={answerVersionId,sessionId:input.sessionId,questionFamilyId:input.questionFamilyId??null,versionKind:input.versionKind,parentVersionId:input.parentVersionId??null};
  db.exec('BEGIN;'); try{
    db.prepare(`INSERT INTO interview_answer_versions(id,session_id,turn_id,question_family_id,parent_version_id,version_kind,content,critique_summary,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(answerVersionId,input.sessionId,input.turnId??null,input.questionFamilyId??null,input.parentVersionId??null,input.versionKind,input.content,input.critiqueSummary??null,now);
    recordRequest(db,input.requestId,operation,input.sessionId,response,now); db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
function nextGrowthStatus(current:string|undefined,type:ObservationType){
  if(type==='IMPROVEMENT') return 'IMPROVING';
  if(type==='REGRESSION') return 'REGRESSING';
  if(type==='RESOLUTION') return 'RESOLVED';
  if(type==='OCCURRENCE'&&current==='RESOLVED') return 'REGRESSING';
  return current??'OPEN';
}

export function recordGrowthObservation(db:any,input:{requestId:string;stableKey:string;itemType:GrowthItemType;dimensionType:DimensionType;dimensionRef?:string;title:string;summary:string;severity?:'LOW'|'MEDIUM'|'HIGH';sessionId?:string;turnId?:string;observationType:ObservationType;evidenceText:string;scoreValue?:number},now=new Date().toISOString()){
  const operation='interview.record_growth_observation';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  if(input.sessionId) ensureSession(db,input.sessionId);
  if(input.turnId&&input.sessionId&&!db.prepare('SELECT 1 FROM interview_turns WHERE id=? AND session_id=?').get(input.turnId,input.sessionId)) throw new Error('INTERVIEW_TURN_NOT_FOUND');
  const existing:any=db.prepare('SELECT * FROM interview_growth_items WHERE stable_key=?').get(input.stableKey);
  const growthItemId=existing?.id??`growth.${randomUUID()}`;
  const occurrenceDelta=input.observationType==='OCCURRENCE'||input.observationType==='REGRESSION'?1:0;
  const practiceDelta=['PRACTICE','IMPROVEMENT','REGRESSION','RESOLUTION'].includes(input.observationType)?1:0;
  const status=nextGrowthStatus(existing?.status,input.observationType);
  const observationId=`growth-observation.${randomUUID()}`;
  const response={growthItemId,observationId,stableKey:input.stableKey,status};
  db.exec('BEGIN;'); try{
    if(existing) db.prepare(`UPDATE interview_growth_items SET title=?,summary=?,severity=?,status=?,occurrence_count=occurrence_count+?,practice_count=practice_count+?,last_seen_at=?,updated_at=? WHERE id=?`)
      .run(input.title,input.summary,input.severity??existing.severity,status,occurrenceDelta,practiceDelta,now,now,growthItemId);
    else db.prepare(`INSERT INTO interview_growth_items(id,stable_key,item_type,dimension_type,dimension_ref,title,summary,severity,status,occurrence_count,practice_count,first_seen_at,last_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(growthItemId,input.stableKey,input.itemType,input.dimensionType,input.dimensionRef??null,input.title,input.summary,input.severity??'MEDIUM',status,occurrenceDelta,practiceDelta,now,now,now);
    db.prepare(`INSERT INTO interview_growth_observations(id,growth_item_id,session_id,turn_id,observation_type,evidence_text,score_value,created_at) VALUES(?,?,?,?,?,?,?,?)`)
      .run(observationId,growthItemId,input.sessionId??null,input.turnId??null,input.observationType,input.evidenceText,input.scoreValue??null,now);
    recordRequest(db,input.requestId,operation,input.sessionId??null,response,now); db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}

export function selectBestAnswer(db:any,input:{requestId:string;questionFamilyId:string;routeId?:string;answerVersionId:string;selectionReason:string},now=new Date().toISOString()){
  const operation='interview.select_best_answer';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  const answer:any=db.prepare('SELECT id,question_family_id,session_id FROM interview_answer_versions WHERE id=?').get(input.answerVersionId);
  if(!answer) throw new Error('INTERVIEW_ANSWER_VERSION_NOT_FOUND');
  if(answer.question_family_id!==input.questionFamilyId) throw new Error('INTERVIEW_BEST_ANSWER_FAMILY_MISMATCH');
  const bestAnswerId=`best-answer.${randomUUID()}`;
  const response={bestAnswerId,answerVersionId:input.answerVersionId,questionFamilyId:input.questionFamilyId,routeId:input.routeId??null};
  db.exec('BEGIN;'); try{
    if(input.routeId) db.prepare("UPDATE interview_best_answer_candidates SET status='RETIRED',updated_at=? WHERE question_family_id=? AND route_id=? AND status='CURRENT'").run(now,input.questionFamilyId,input.routeId);
    else db.prepare("UPDATE interview_best_answer_candidates SET status='RETIRED',updated_at=? WHERE question_family_id=? AND route_id IS NULL AND status='CURRENT'").run(now,input.questionFamilyId);
    db.prepare(`INSERT INTO interview_best_answer_candidates(id,question_family_id,route_id,answer_version_id,status,selection_reason,created_at,updated_at) VALUES(?,?,?,?,'CURRENT',?,?,?)`)
      .run(bestAnswerId,input.questionFamilyId,input.routeId??null,input.answerVersionId,input.selectionReason,now,now);
    recordRequest(db,input.requestId,operation,answer.session_id,response,now); db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
export function enqueueGrowthReview(db:any,input:{requestId:string;targetType:'GROWTH_ITEM'|'ANSWER_VERSION'|'QUESTION_FAMILY'|'TOPIC'|'PROJECT';targetId:string;reason:string;priority?:number;dueAt?:string;sourceSessionId?:string},now=new Date().toISOString()){
  const operation='interview.enqueue_review';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  if(input.sourceSessionId) ensureSession(db,input.sourceSessionId);
  const reviewId=`review.${randomUUID()}`;
  const response={reviewId,targetType:input.targetType,targetId:input.targetId,status:'OPEN'};
  db.exec('BEGIN;'); try{
    db.prepare(`INSERT INTO interview_review_queue(id,target_type,target_id,reason,priority,due_at,status,source_session_id,created_at,updated_at) VALUES(?,?,?,?,?,?,'OPEN',?,?,?)`)
      .run(reviewId,input.targetType,input.targetId,input.reason,input.priority??0,input.dueAt??null,input.sourceSessionId??null,now,now);
    recordRequest(db,input.requestId,operation,input.sourceSessionId??null,response,now); db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}

export function getGrowthProfile(db:any,input:{questionFamilyId?:string;routeId?:string;status?:string[];reviewStatus?:string}={}){
  const statuses=input.status?.length?input.status:['OPEN','IMPROVING','STABLE','REGRESSING'];
  const placeholders=statuses.map(()=>'?').join(',');
  const items:any[]=db.prepare(`SELECT * FROM interview_growth_items WHERE status IN (${placeholders}) ORDER BY severity DESC,last_seen_at DESC`).all(...statuses) as any[];
  const growthItems=items.map(item=>({
    growthItemId:item.id,stableKey:item.stable_key,itemType:item.item_type,dimensionType:item.dimension_type,dimensionRef:item.dimension_ref,
    title:item.title,summary:item.summary,severity:item.severity,status:item.status,occurrenceCount:item.occurrence_count,practiceCount:item.practice_count,
    firstSeenAt:item.first_seen_at,lastSeenAt:item.last_seen_at,
    observations:(db.prepare('SELECT id,session_id,turn_id,observation_type,evidence_text,score_value,created_at FROM interview_growth_observations WHERE growth_item_id=? ORDER BY created_at,id').all(item.id) as any[])
  }));
  let answerHistory:any[]=[]; let currentBestAnswer:any=null;
  if(input.questionFamilyId){
    answerHistory=db.prepare(`SELECT id answerVersionId,session_id sessionId,turn_id turnId,parent_version_id parentVersionId,version_kind versionKind,content,critique_summary critiqueSummary,created_at createdAt FROM interview_answer_versions WHERE question_family_id=? ORDER BY created_at,id`).all(input.questionFamilyId) as any[];
    const bestSql=input.routeId
      ? `SELECT b.id bestAnswerId,b.answer_version_id answerVersionId,b.selection_reason selectionReason,a.content,a.version_kind versionKind FROM interview_best_answer_candidates b JOIN interview_answer_versions a ON a.id=b.answer_version_id WHERE b.question_family_id=? AND b.route_id=? AND b.status='CURRENT'`
      : `SELECT b.id bestAnswerId,b.answer_version_id answerVersionId,b.selection_reason selectionReason,a.content,a.version_kind versionKind FROM interview_best_answer_candidates b JOIN interview_answer_versions a ON a.id=b.answer_version_id WHERE b.question_family_id=? AND b.route_id IS NULL AND b.status='CURRENT'`;
    currentBestAnswer=input.routeId?db.prepare(bestSql).get(input.questionFamilyId,input.routeId):db.prepare(bestSql).get(input.questionFamilyId);
  }
  const reviewStatus=input.reviewStatus??'OPEN';
  const reviewQueue=(db.prepare(`SELECT id reviewId,target_type targetType,target_id targetId,reason,priority,due_at dueAt,status,source_session_id sourceSessionId,created_at createdAt,updated_at updatedAt FROM interview_review_queue WHERE status=? ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,due_at,priority DESC,created_at`).all(reviewStatus) as any[]);
  const debriefs=(db.prepare(`SELECT id debriefId,session_id sessionId,revision,verdict,score_value scoreValue,score_reason scoreReason,created_at createdAt FROM interview_round_debriefs ORDER BY created_at DESC LIMIT 20`).all() as any[]);
  return {growthItems,answerHistory,currentBestAnswer:currentBestAnswer??null,reviewQueue,debriefs};
}
