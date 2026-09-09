import { randomUUID } from 'node:crypto';
import { retrieveInterviewCandidates } from './interview-retrieval.ts';

type SessionMode='REAL'|'VOICE'|'MOCK'|'TEXT';
type TurnIntent='ASK'|'FOLLOW_UP'|'CHALLENGE'|'CLARIFY'|'RECOVER'|'CLOSE_SIGNAL';

export const INTERVIEW_RUNTIME_TOOL_CONTRACTS={
  'interview.start_session':{sideEffect:'WRITE',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.next_turn':{sideEffect:'WRITE_SELECTION_EVENT',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.observe_answer':{sideEffect:'APPEND_RUNTIME_OBSERVATION',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.resolve_evidence':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

const SCENE_POLICY:Record<string,{signal:string;query:string;depth:number;seconds:number}>={
  'scene.hr':{signal:'signal.risk',query:'招聘初筛 离职 职业转向 学历 到岗 稳定性 薪资 固定事实 可协商条件',depth:1,seconds:60},
  'scene.tech1':{signal:'signal.baseline',query:'技术基础 runtime coding debugging browser javascript frontend execution model',depth:2,seconds:90},
  'scene.deep-dive':{signal:'signal.ownership',query:'项目 ownership 主导 scope 判断 failure evidence',depth:3,seconds:120},
  'scene.system-design':{signal:'signal.judgment',query:'system design architecture constraint tradeoff judgment',depth:3,seconds:150},
  'scene.coding':{signal:'signal.baseline',query:'coding debugging implementation verify repair',depth:2,seconds:120},
  'scene.fde-case':{signal:'signal.judgment',query:'FDE requirement decomposition delivery risk customer case',depth:3,seconds:150},
  'scene.hm':{signal:'signal.value',query:'value adoption quality reliability engineering impact future value',depth:3,seconds:120},
  'scene.cross':{signal:'signal.transferability',query:'cross functional collaboration ownership transferability interface',depth:2,seconds:90},
  'scene.final':{signal:'signal.risk',query:'residual risk truthfulness direction consistency',depth:2,seconds:90},
  'scene.offer':{signal:'signal.risk',query:'offer negotiation constraint BATNA compensation tradeoff',depth:1,seconds:90},
};
function parseStored(row:any,operation:string){
  if(!row) return null;
  if(row.operation!==operation) throw new Error('REQUEST_ID_OPERATION_MISMATCH');
  if(row.status!=='APPLIED'||!row.response_json) throw new Error('REQUEST_ID_STATE_UNRECOVERABLE');
  return JSON.parse(row.response_json);
}
function existingRequest(db:any,requestId:string,operation:string){
  return parseStored(db.prepare('SELECT operation,status,response_json FROM interview_idempotency_requests WHERE request_id=?').get(requestId),operation);
}
function recordRequest(db:any,requestId:string,operation:string,sessionId:string|null,response:any,now:string){
  db.prepare(`INSERT INTO interview_idempotency_requests(request_id,operation,session_id,status,response_json,created_at,updated_at)
    VALUES(?,?,?,'APPLIED',?,?,?)`).run(requestId,operation,sessionId,JSON.stringify(response),now,now);
}
function getActiveSession(db:any,sessionId:string){
  const row:any=db.prepare(`SELECT s.*,r.name route_name,sc.name scene_name,sc.interviewer_role,sc.evidence_gate
    FROM interview_sessions s JOIN interview_role_profiles r ON r.id=s.route_id
    JOIN interview_scene_profiles sc ON sc.id=s.scene_id WHERE s.id=?`).get(sessionId);
  if(!row) throw new Error('INTERVIEW_SESSION_NOT_FOUND');
  if(row.status!=='ACTIVE') throw new Error('INTERVIEW_SESSION_NOT_ACTIVE');
  return row;
}
function fallbackFor(sceneId:string){
  if(sceneId==='scene.hr') return '我换个角度确认一下：你当前求职最核心的方向和不能妥协的条件分别是什么？';
  if(sceneId==='scene.tech1'||sceneId==='scene.coding') return '先不展开新题，请基于刚才的答案说明你会怎样验证自己的判断。';
  return '先沿着刚才的回答继续：哪一项证据最能支持你的判断，哪一项还存在不确定性？';
}
export function startInterviewSession(db:any,input:{requestId:string;mode:SessionMode;routeId:string;sceneId:string;jobId?:string;interviewerRole?:string;difficulty?:string},now=new Date().toISOString()){
  const cached=existingRequest(db,input.requestId,'interview.start_session'); if(cached) return cached;
  const route=db.prepare("SELECT id FROM interview_role_profiles WHERE id=? AND lifecycle='ACTIVE'").get(input.routeId);
  const scene:any=db.prepare("SELECT id,interviewer_role FROM interview_scene_profiles WHERE id=? AND lifecycle='ACTIVE'").get(input.sceneId);
  if(!route) throw new Error('INTERVIEW_ROUTE_NOT_FOUND');
  if(!scene) throw new Error('INTERVIEW_SCENE_NOT_FOUND');
  const sessionId=`session.${randomUUID()}`;
  const response={sessionId,status:'ACTIVE',routeId:input.routeId,sceneId:input.sceneId,mode:input.mode,signalCount:10};
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO interview_sessions(id,mode,route_id,scene_id,job_id,interviewer_role,difficulty,status,strategy_version,corpus_version,started_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,'ACTIVE','strategy.kernel.v2','formal-corpus.v1',?,?,?)`)
      .run(sessionId,input.mode,input.routeId,input.sceneId,input.jobId??null,input.interviewerRole??scene.interviewer_role,input.difficulty??null,now,now,now);
    const insertSignal=db.prepare(`INSERT INTO interview_session_signals(session_id,signal_id,state,confidence,last_turn_id,updated_at)
      VALUES(?,?,'UNTESTED',NULL,NULL,?)`);
    for(const row of db.prepare("SELECT id FROM interview_signals WHERE lifecycle='ACTIVE' ORDER BY id").all() as any[]) insertSignal.run(sessionId,row.id,now);
    recordRequest(db,input.requestId,'interview.start_session',sessionId,response,now);
    db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
function runtimeState(db:any,sessionId:string){
  const hypothesis:any=db.prepare("SELECT statement,confidence FROM interview_session_hypotheses WHERE session_id=? AND status='ACTIVE' ORDER BY updated_at DESC LIMIT 1").get(sessionId);
  const risk:any=db.prepare("SELECT summary,severity FROM interview_session_risks WHERE session_id=? AND status IN ('OPEN','REOPENED') ORDER BY CASE severity WHEN 'FATAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,updated_at DESC LIMIT 1").get(sessionId);
  const debt:any=db.prepare("SELECT claim_text,strength FROM interview_claim_debts WHERE session_id=? AND status IN ('OPEN','PARTIALLY_VERIFIED') ORDER BY created_at DESC LIMIT 1").get(sessionId);
  return {hypothesis,risk,debt};
}
function familyEvaluation(db:any,familyId:string){
  const rows:any[]=db.prepare(`SELECT polarity,observable_behavior FROM interview_scoring_anchors
    WHERE question_family_id=? AND lifecycle='ACTIVE' ORDER BY polarity,id`).all(familyId) as any[];
  return {
    positiveAnchors:rows.filter(r=>String(r.polarity).includes('POSITIVE')).map(r=>r.observable_behavior).slice(0,2),
    negativeAnchors:rows.filter(r=>String(r.polarity).includes('NEGATIVE')).map(r=>r.observable_behavior).slice(0,2),
  };
}
function familyEvidence(db:any,familyId:string,routeId:string){
  return db.prepare(`SELECT e.id,e.short_hint,b.id boundary_id,b.boundary_type,b.required_qualifier,b.forbidden_expansion,l.strength
    FROM interview_question_evidence_links l JOIN interview_evidence_refs e ON e.id=l.evidence_ref_id
    JOIN interview_claim_boundaries b ON b.id=l.claim_boundary_id AND b.evidence_ref_id=e.id
    WHERE l.question_family_id=? AND l.route_id=? AND l.lifecycle='ACTIVE' AND e.lifecycle='ACTIVE' AND b.lifecycle='ACTIVE'
    ORDER BY CASE l.strength WHEN 'STRONG' THEN 4 WHEN 'MEDIUM' THEN 3 WHEN 'WEAK' THEN 2 ELSE 1 END DESC,e.id LIMIT 3`).all(familyId,routeId) as any[];
}
function optionalFollowups(db:any,questionId:string){
  return (db.prepare("SELECT text FROM interview_question_variants WHERE question_id=? AND lifecycle='ACTIVE' ORDER BY id LIMIT 2").all(questionId) as any[]).map(r=>r.text);
}
function nextTurnIndex(db:any,sessionId:string){
  return Number((db.prepare('SELECT COALESCE(MAX(turn_index),0)+1 n FROM interview_turns WHERE session_id=?').get(sessionId) as any).n);
}
function validatePreferredFamily(db:any,familyId:string,routeId:string){
  const family=db.prepare("SELECT id FROM interview_question_families WHERE id=? AND lifecycle='ACTIVE'").get(familyId);
  if(!family) throw new Error('INTERVIEW_PREFERRED_FAMILY_NOT_FOUND');
  const question=db.prepare("SELECT 1 ok FROM interview_questions WHERE question_family_id=? AND lifecycle='ACTIVE' LIMIT 1").get(familyId);
  if(!question) throw new Error('INTERVIEW_PREFERRED_FAMILY_HAS_NO_ACTIVE_QUESTION');
  const bound=Number((db.prepare("SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id=? AND lifecycle='ACTIVE'").get(familyId) as any).c);
  const routeBound=Number((db.prepare("SELECT COUNT(*) c FROM interview_question_evidence_links WHERE question_family_id=? AND route_id=? AND lifecycle='ACTIVE'").get(familyId,routeId) as any).c);
  if(bound>0&&routeBound===0) throw new Error('INTERVIEW_PREFERRED_FAMILY_NOT_ELIGIBLE');
}
function inferDirectorPhaseTransition(db:any,sessionId:string):'OPENING'|'CANDIDATE_QUESTIONS'|null{
  const stored:any=db.prepare('SELECT plan_json FROM interview_director_session_plans WHERE session_id=?').get(sessionId);
  if(!stored) return null;
  const plan=JSON.parse(stored.plan_json); const phases=[...(plan.phases??[])].sort((a:any,b:any)=>a.order-b.order);
  const latest:any=db.prepare('SELECT phase_id,action,next_phase_id FROM interview_director_decisions WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(sessionId);
  const phaseId=latest?.action==='ADVANCE_PHASE'&&latest.next_phase_id?latest.next_phase_id:(latest?.phase_id??phases[0]?.id);
  if(phaseId==='OPENING'){
    const turns=Number((db.prepare('SELECT COUNT(*) c FROM interview_turns WHERE session_id=?').get(sessionId) as any).c);
    return turns===0?'OPENING':null;
  }
  return phaseId==='CANDIDATE_QUESTIONS'?'CANDIDATE_QUESTIONS':null;
}
export function nextInterviewTurn(db:any,input:{requestId:string;sessionId:string;desiredAction?:TurnIntent;preferredFamilyId?:string;targetSignalId?:string;phaseTransition?:'OPENING'|'CANDIDATE_QUESTIONS'},now=new Date().toISOString()){
  const cached=existingRequest(db,input.requestId,'interview.next_turn'); if(cached) return cached;
  const session=getActiveSession(db,input.sessionId);
  const policy=SCENE_POLICY[session.scene_id]??SCENE_POLICY['scene.deep-dive'];
  const last:any=db.prepare('SELECT question_family_id FROM interview_turns WHERE session_id=? ORDER BY turn_index DESC LIMIT 1').get(input.sessionId);
  let query=policy.query;
  if(session.scene_id==='scene.tech1'&&session.route_id==='route.advanced-fe-fullstack') query='browser javascript runtime frontend execution model 主线程 渲染 异步 状态';
  if(session.scene_id==='scene.hm'&&session.route_id==='route.ai-agent-devtools') query='developer tools adoption usage quality reliability value evidence';
  const desired=input.desiredAction??'ASK';
  const phaseTransition=input.phaseTransition??inferDirectorPhaseTransition(db,input.sessionId);
  const opening=phaseTransition==='OPENING', candidateQuestions=phaseTransition==='CANDIDATE_QUESTIONS', scriptedTransition=opening||candidateQuestions;
  if(input.preferredFamilyId) validatePreferredFamily(db,input.preferredFamilyId,session.route_id);
  const retrieval=scriptedTransition?{candidates:[]}:retrieveInterviewCandidates(db,{sessionId:input.sessionId,routeId:session.route_id,
    targetSignalId:input.preferredFamilyId?undefined:(input.targetSignalId??policy.signal),preferredFamilyId:input.preferredFamilyId,
    currentFamilyId:last?.question_family_id??undefined,intent:desired==='FOLLOW_UP'?'FOLLOW_UP':desired==='CHALLENGE'?'CHALLENGE':'ASK',queryText:query,limit:5});
  const chosen:any=retrieval.candidates[0];
  if(input.preferredFamilyId&&!chosen) throw new Error('INTERVIEW_PREFERRED_FAMILY_EXHAUSTED');
  const live=runtimeState(db,input.sessionId);
  const fallback=opening?'我们先开始。请用一两分钟介绍一下你自己，以及与你当前应聘方向最相关的一段经历。':candidateQuestions?'我这边主要问题差不多了，你有什么想了解的吗？':fallbackFor(session.scene_id);
  const evaluation=chosen?familyEvaluation(db,chosen.familyId):{positiveAnchors:[],negativeAnchors:[]};
  const evidence:any[]=chosen?familyEvidence(db,chosen.familyId,session.route_id):[];
  const pack:any={schemaVersion:'interview.turn-pack.v1',sessionId:input.sessionId,turnIntent:scriptedTransition?'ASK':chosen?desired:'RECOVER',
    scene:{id:session.scene_id,interviewerRole:session.interviewer_role,evidenceGate:session.evidence_gate},
    state:{currentHypothesis:live.hypothesis?.statement??null,targetSignal:scriptedTransition?null:(chosen?.signalId??input.targetSignalId??policy.signal),residualRisk:live.risk?.summary??null,claimDebt:live.debt?.claim_text??null},
    prompt:{familyId:chosen?.familyId??null,questionId:chosen?.questionId??null,primaryQuestion:chosen?.text??fallback,optionalFollowups:chosen?optionalFollowups(db,chosen.questionId):[],challengeMode:scriptedTransition?null:desired==='CHALLENGE'?'PRESSURE':null},
    evaluation:{positiveAnchors:evaluation.positiveAnchors,negativeAnchors:evaluation.negativeAnchors,stopCondition:opening?'完成简短开场后进入本轮主要取证阶段。':candidateQuestions?'候选人提问完成后收口。':'获得足够可验证证据，或确认当前 Signal 的残余风险后收口。'},
    candidate:{evidenceRefs:evidence.map(r=>({id:r.id,hint:r.short_hint})),claimBoundary:evidence[0]?.required_qualifier??null,forbiddenExpansion:evidence[0]?.forbidden_expansion??null},
    runtime:{depthTarget:scriptedTransition?0:policy.depth,timeTargetSeconds:opening?180:candidateQuestions?300:policy.seconds,nextStateHint:opening?'OPENING_THEN_DIRECTOR_ADVANCE':candidateQuestions?'CANDIDATE_QUESTIONS_THEN_CLOSE':`OBSERVE_ANSWER_THEN_UPDATE_${chosen?.signalId??policy.signal}`,fallbackPrompt:fallback}};
  const turnId=`turn.${randomUUID()}`; const turnIndex=nextTurnIndex(db,input.sessionId);
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO interview_turns(id,session_id,turn_index,question_id,question_family_id,turn_intent,selected_evidence_json,created_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(turnId,input.sessionId,turnIndex,chosen?.questionId??null,chosen?.familyId??null,pack.turnIntent,JSON.stringify(evidence.map(r=>r.id)),now);
    if(chosen) db.prepare(`UPDATE interview_session_signals SET state=CASE WHEN state='UNTESTED' THEN 'PROBING' ELSE state END,last_turn_id=?,updated_at=?
      WHERE session_id=? AND signal_id=?`).run(turnId,now,input.sessionId,chosen.signalId);
    pack.turnId=turnId;
    recordRequest(db,input.requestId,'interview.next_turn',input.sessionId,pack,now);
    db.exec('COMMIT;'); return pack;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
export function observeInterviewAnswer(db:any,input:{requestId:string;sessionId:string;turnId:string;answerObservation:{summary?:string;detectedClaims?:Array<{text:string;evidenceRefId?:string;strength?:'NORMAL'|'STRONG'}>;evidenceUsed?:string[];signalUpdate?:{signalId:string;state:'UNTESTED'|'PROBING'|'CONFIRMED'|'WEAKENED'|'CLOSED';confidence?:number};riskUpdate?:{riskKey?:string;summary:string;severity:'LOW'|'MEDIUM'|'HIGH'|'FATAL';status:'OPEN'|'CLOSED'|'REOPENED'};timing?:{durationMs?:number}}},now=new Date().toISOString()){
  const cached=existingRequest(db,input.requestId,'interview.observe_answer'); if(cached) return cached;
  getActiveSession(db,input.sessionId);
  const turn:any=db.prepare('SELECT id FROM interview_turns WHERE id=? AND session_id=?').get(input.turnId,input.sessionId);
  if(!turn) throw new Error('INTERVIEW_TURN_NOT_FOUND');
  const o=input.answerObservation??{}; const claims=o.detectedClaims??[]; let riskId:string|null=null;
  const response:any={sessionId:input.sessionId,turnId:input.turnId,claimsCreated:claims.length,signalUpdated:Boolean(o.signalUpdate),riskUpdated:Boolean(o.riskUpdate)};
  db.exec('BEGIN;');
  try{
    db.prepare(`UPDATE interview_turns SET answer_summary=COALESCE(?,answer_summary),selected_evidence_json=COALESCE(?,selected_evidence_json),duration_ms=COALESCE(?,duration_ms) WHERE id=?`)
      .run(o.summary??null,o.evidenceUsed===undefined?null:JSON.stringify(o.evidenceUsed),o.timing?.durationMs??null,input.turnId);
    if(o.signalUpdate) db.prepare(`UPDATE interview_session_signals SET state=?,confidence=?,last_turn_id=?,updated_at=? WHERE session_id=? AND signal_id=?`)
      .run(o.signalUpdate.state,o.signalUpdate.confidence??null,input.turnId,now,input.sessionId,o.signalUpdate.signalId);
    for(const claim of claims) db.prepare(`INSERT INTO interview_claim_debts(id,session_id,claim_text,evidence_ref_id,strength,status,source_turn_id,created_at,updated_at)
      VALUES(?,?,?,?,?,'OPEN',?,?,?)`).run(`claim.${randomUUID()}`,input.sessionId,claim.text,claim.evidenceRefId??null,claim.strength??'NORMAL',input.turnId,now,now);
    if(o.riskUpdate){
      const existing:any=o.riskUpdate.riskKey?db.prepare(`SELECT id,opened_at FROM interview_session_risks WHERE session_id=? AND risk_key=? ORDER BY updated_at DESC LIMIT 1`).get(input.sessionId,o.riskUpdate.riskKey):null;
      if(existing){
        riskId=existing.id;
        db.prepare(`UPDATE interview_session_risks SET summary=?,severity=?,status=?,last_turn_id=?,closed_at=?,updated_at=? WHERE id=?`)
          .run(o.riskUpdate.summary,o.riskUpdate.severity,o.riskUpdate.status,input.turnId,o.riskUpdate.status==='CLOSED'?now:null,now,riskId);
      }else{
        riskId=`risk.${randomUUID()}`;
        db.prepare(`INSERT INTO interview_session_risks(id,session_id,risk_key,summary,severity,status,last_turn_id,opened_at,closed_at,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(riskId,input.sessionId,o.riskUpdate.riskKey??null,o.riskUpdate.summary,o.riskUpdate.severity,o.riskUpdate.status,input.turnId,now,o.riskUpdate.status==='CLOSED'?now:null,now,now);
      }
    }
    response.riskId=riskId; recordRequest(db,input.requestId,'interview.observe_answer',input.sessionId,response,now);
    db.exec('COMMIT;'); return response;
  }catch(error){try{db.exec('ROLLBACK;');}catch{} throw error;}
}
export function resolveInterviewEvidence(db:any,input:{evidenceRefId:string}){
  const row:any=db.prepare(`SELECT e.id,e.stable_key,e.canonical_path,e.canonical_key,e.source_kind,e.evidence_status,e.short_hint,
    b.id boundary_id,b.boundary_type,b.allowed_claim,b.required_qualifier,b.forbidden_expansion
    FROM interview_evidence_refs e LEFT JOIN interview_claim_boundaries b ON b.evidence_ref_id=e.id AND b.lifecycle='ACTIVE'
    WHERE e.id=? AND e.lifecycle='ACTIVE'`).get(input.evidenceRefId);
  if(!row) throw new Error('INTERVIEW_EVIDENCE_NOT_FOUND');
  return {evidenceRef:{id:row.id,stableKey:row.stable_key,canonicalPath:row.canonical_path,canonicalKey:row.canonical_key,
    sourceKind:row.source_kind,evidenceStatus:row.evidence_status,shortHint:row.short_hint},
    claimBoundary:row.boundary_id?{id:row.boundary_id,type:row.boundary_type,allowedClaim:row.allowed_claim,
      requiredQualifier:row.required_qualifier,forbiddenExpansion:row.forbidden_expansion}:null};
}
