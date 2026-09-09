import { randomUUID } from 'node:crypto';

type LearningOutcome='READY_FOR_REVIEW'|'PARTIAL'|'BLOCKED';
type ReviewTargetType='GROWTH_ITEM'|'QUESTION_FAMILY'|'TOPIC'|'PROJECT';

export const LEARNING_BRIDGE_TOOL_CONTRACTS={
  'learning.list_interview_handoffs':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.record_interview_handoff_result':{sideEffect:'RECORD_LEARNING_RESULT_AND_OPTIONAL_REVIEW',idempotentBy:'request_id',careerFactsMutable:false},
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

export function listInterviewLearningHandoffs(db:any,input:{status?:'OPEN'|'DONE'|'DISMISSED';limit?:number}={}){
  const status=input.status??'OPEN';
  const limit=Math.max(1,Math.min(50,Number(input.limit??20)));
  const rows:any[]=db.prepare(`SELECT t.id training_event_id,t.session_id,t.next_action,t.target_ref,t.status,t.created_at,
    f.id feedback_event_id,f.target_type,f.target_id,f.observation,f.score_suggestion,
    s.mode,s.route_id,s.scene_id,s.job_id
    FROM interview_training_events t
    JOIN interview_feedback_events f ON f.id=t.feedback_event_id
    LEFT JOIN interview_sessions s ON s.id=t.session_id
    WHERE t.next_action='LEARNING' AND t.status=?
    ORDER BY t.created_at,t.id LIMIT ?`).all(status,limit) as any[];
  return {status,count:rows.length,items:rows.map(row=>{
    const targetId=row.target_id??row.target_ref??null;
    let targetType=row.target_type;
    if(targetId&&row.target_type==='LEARNING'){
      if(db.prepare("SELECT 1 FROM interview_knowledge_topics WHERE id=? AND lifecycle='ACTIVE'").get(targetId)) targetType='TOPIC';
      else if(db.prepare("SELECT 1 FROM interview_question_families WHERE id=? AND lifecycle='ACTIVE'").get(targetId)) targetType='QUESTION_FAMILY';
    }
    return {
      handoffId:row.training_event_id,trainingEventId:row.training_event_id,feedbackEventId:row.feedback_event_id,
      nextAction:'LEARNING',status:row.status,target:{type:targetType,id:targetId},
      observation:row.observation,scoreSuggestion:row.score_suggestion??null,
      source:{sessionId:row.session_id,mode:row.mode,routeId:row.route_id,sceneId:row.scene_id,jobId:row.job_id??null},
      createdAt:row.created_at
    };
  })};
}

export function recordInterviewLearningHandoffResult(db:any,input:{requestId:string;trainingEventId:string;outcome:LearningOutcome;summary:string;artifactRefs?:string[];reviewTargetType?:ReviewTargetType;reviewTargetId?:string;dueAt?:string},now=new Date().toISOString()){
  const operation='learning.record_interview_handoff_result';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  if(!String(input.summary??'').trim()) throw new Error('LEARNING_HANDOFF_SUMMARY_REQUIRED');
  const action:any=db.prepare(`SELECT t.id,t.session_id,t.next_action,t.target_ref,t.status,f.target_type,f.target_id
    FROM interview_training_events t JOIN interview_feedback_events f ON f.id=t.feedback_event_id WHERE t.id=?`).get(input.trainingEventId);
  if(!action) throw new Error('LEARNING_HANDOFF_NOT_FOUND');
  if(action.next_action!=='LEARNING') throw new Error('LEARNING_HANDOFF_ACTION_MISMATCH');
  if(action.status!=='OPEN') throw new Error('LEARNING_HANDOFF_NOT_OPEN');
  const ready=input.outcome==='READY_FOR_REVIEW';
  if(ready&&(!input.reviewTargetType||!input.reviewTargetId)) throw new Error('LEARNING_REVIEW_TARGET_REQUIRED');
  const feedbackId=`feedback.learning.${randomUUID()}`;
  const reviewId=ready?`review.learning.${randomUUID()}`:null;
  const response={trainingEventId:input.trainingEventId,outcome:input.outcome,trainingStatus:ready?'DONE':'OPEN',feedbackId,reviewId};
  const payload=JSON.stringify({outcome:input.outcome,summary:input.summary,artifactRefs:input.artifactRefs??[]});
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO interview_feedback_events(id,session_id,turn_id,event_type,target_type,target_id,observation,score_suggestion,classification,created_at)
      VALUES(?,?,NULL,'DEBRIEF','LEARNING',?,?,NULL,NULL,?)`).run(feedbackId,action.session_id,input.trainingEventId,payload,now);
    if(ready){
      db.prepare("UPDATE interview_training_events SET status='DONE',updated_at=? WHERE id=?").run(now,input.trainingEventId);
      db.prepare(`INSERT INTO interview_review_queue(id,target_type,target_id,reason,priority,due_at,status,source_session_id,created_at,updated_at)
        VALUES(?,?,?,?,0,?,'OPEN',?,?,?)`).run(reviewId,input.reviewTargetType,input.reviewTargetId,`Learning completed: ${input.summary}`,input.dueAt??null,action.session_id,now,now);
    }
    recordRequest(db,input.requestId,operation,action.session_id,response,now);
    db.exec('COMMIT;'); return response;
  }catch(error){ try{db.exec('ROLLBACK;')}catch{} throw error; }
}
