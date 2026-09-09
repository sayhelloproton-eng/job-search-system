import { randomUUID } from 'node:crypto';

type Classification='A'|'B'|'C'|'D'|'E'|'F';
type EventType='VOICE_SCORE'|'HUMAN_FEEDBACK'|'INTERVIEWER_REACTION'|'REAL_INTERVIEW_OBSERVATION'|'DEBRIEF';
type TargetType='QUESTION'|'QUESTION_FAMILY'|'EVIDENCE'|'BLUEPRINT'|'LEARNING'|'RESUME'|'SESSION'|'SIGNAL';
type FinishStatus='FINISHED'|'ABORTED';

export const INTERVIEW_FEEDBACK_TOOL_CONTRACTS={
  'interview.finish_session':{sideEffect:'CLOSE_SESSION',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.record_human_feedback':{sideEffect:'APPEND_FEEDBACK_AND_TRAINING_EVENT',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.list_training_actions':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

const NEXT_ACTION:Record<Classification,string>={
  A:'REINFORCE',B:'BLUEPRINT',C:'ADD_EVIDENCE',D:'LEARNING',E:'TRADEOFF',F:'RESUME'
};
function existingRequest(db:any,requestId:string,operation:string){
  const row:any=db.prepare('SELECT operation,status,response_json FROM interview_idempotency_requests WHERE request_id=?').get(requestId);
  if(!row) return null;
  if(row.operation!==operation) throw new Error('REQUEST_ID_OPERATION_MISMATCH');
  if(row.status!=='APPLIED'||!row.response_json) throw new Error('REQUEST_ID_STATE_UNRECOVERABLE');
  return JSON.parse(row.response_json);
}
function recordRequest(db:any,requestId:string,operation:string,sessionId:string,response:any,now:string){
  db.prepare(`INSERT INTO interview_idempotency_requests(request_id,operation,session_id,status,response_json,created_at,updated_at)
    VALUES(?,?,?,'APPLIED',?,?,?)`).run(requestId,operation,sessionId,JSON.stringify(response),now,now);
}
function getSession(db:any,sessionId:string){
  const row:any=db.prepare('SELECT id,status FROM interview_sessions WHERE id=?').get(sessionId);
  if(!row) throw new Error('INTERVIEW_SESSION_NOT_FOUND');
  return row;
}
export function recordInterviewFeedback(db:any,input:{requestId:string;sessionId:string;turnId?:string;eventType:EventType;targetType:TargetType;targetId?:string;observation:string;scoreSuggestion?:number;classification?:Classification},now=new Date().toISOString()){
  const operation='interview.record_human_feedback';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  getSession(db,input.sessionId);
  if(input.turnId){
    const turn=db.prepare('SELECT id FROM interview_turns WHERE id=? AND session_id=?').get(input.turnId,input.sessionId);
    if(!turn) throw new Error('INTERVIEW_TURN_NOT_FOUND');
  }
  const feedbackId=`feedback.${randomUUID()}`;
  const nextAction=input.classification?NEXT_ACTION[input.classification]:null;
  const trainingId=input.classification?`training.${randomUUID()}`:null;
  const response={feedbackId,trainingId,sessionId:input.sessionId,classification:input.classification??null,nextAction};
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO interview_feedback_events(id,session_id,turn_id,event_type,target_type,target_id,observation,score_suggestion,classification,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(feedbackId,input.sessionId,input.turnId??null,input.eventType,input.targetType,input.targetId??null,input.observation,input.scoreSuggestion??null,input.classification??null,now);
    if(input.classification) db.prepare(`INSERT INTO interview_training_events(id,feedback_event_id,session_id,classification,next_action,target_ref,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'OPEN',?,?)`).run(trainingId,feedbackId,input.sessionId,input.classification,nextAction,input.targetId??null,now,now);
    recordRequest(db,input.requestId,operation,input.sessionId,response,now);
    db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}

export function finishInterviewSession(db:any,input:{requestId:string;sessionId:string;status?:FinishStatus},now=new Date().toISOString()){
  const operation='interview.finish_session';
  const cached=existingRequest(db,input.requestId,operation); if(cached) return cached;
  const session=getSession(db,input.sessionId);
  if(session.status!=='ACTIVE') throw new Error('INTERVIEW_SESSION_NOT_ACTIVE');
  const status=input.status??'FINISHED';
  const response={sessionId:input.sessionId,status,finishedAt:now};
  db.exec('BEGIN;');
  try{
    db.prepare('UPDATE interview_sessions SET status=?,finished_at=?,updated_at=? WHERE id=?').run(status,now,now,input.sessionId);
    recordRequest(db,input.requestId,operation,input.sessionId,response,now);
    db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}

const ACTION_OWNER:Record<string,string>={
  REINFORCE:'INTERVIEW_TRAINING',BLUEPRINT:'INTERVIEW_BLUEPRINT',ADD_EVIDENCE:'CANDIDATE_EVIDENCE',
  LEARNING:'JD_GAP_LEARNING',TRADEOFF:'INTERVIEW_RESEARCH',RESUME:'RESUME_ENGINEERING'
};

export function listInterviewTrainingActions(db:any,input:{sessionId?:string;status?:'OPEN'|'DONE'|'DISMISSED';limit?:number}={}){
  const status=input.status??'OPEN';
  const limit=Math.max(1,Math.min(50,Number(input.limit??20)));
  const where=['t.status=?']; const args:any[]=[status];
  if(input.sessionId){where.push('t.session_id=?');args.push(input.sessionId);}
  const rows:any[]=db.prepare(`SELECT t.id,t.session_id,t.classification,t.next_action,t.target_ref,t.status,t.created_at,
    f.id feedback_event_id,f.event_type,f.target_type,f.target_id,f.observation,f.score_suggestion,
    s.mode,s.route_id,s.scene_id
    FROM interview_training_events t
    JOIN interview_feedback_events f ON f.id=t.feedback_event_id
    LEFT JOIN interview_sessions s ON s.id=t.session_id
    WHERE ${where.join(' AND ')} ORDER BY t.created_at ASC,t.id ASC LIMIT ?`).all(...args,limit) as any[];
  return {status,count:rows.length,items:rows.map(row=>({
    trainingEventId:row.id,feedbackEventId:row.feedback_event_id,sessionId:row.session_id,
    classification:row.classification,nextAction:row.next_action,ownerWorkflow:ACTION_OWNER[row.next_action]??'INTERVIEW_REVIEW',
    target:{type:row.target_type,id:row.target_id??row.target_ref??null},observation:row.observation,
    source:{eventType:row.event_type,mode:row.mode,routeId:row.route_id,sceneId:row.scene_id},
    scoreSuggestion:row.score_suggestion??null,status:row.status,createdAt:row.created_at
  }))};
}
