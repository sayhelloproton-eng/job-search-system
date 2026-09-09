import { randomUUID } from 'node:crypto';
import { buildDefaultDirectorPlan } from './interview-director-profiles.ts';

type DirectorAction='PROBE_DEPTH'|'CHALLENGE_TRADEOFF'|'CROSS_CHECK_CLAIM'|'CLARIFY'|'PIVOT_TOPIC'|'ADVANCE_PHASE'|'CLOSE_ROUND'|'RECOVER';
type FocusSpec={signalId:string;priority:'P0'|'P1'|'P2';required:boolean;targetState:'CONFIRMED'|'WEAKENED'|'CLOSED';minimumEvidenceCount:number;maxProbeDepth:number;stopWhen?:string[]};
type PhaseSpec={id:string;name?:string;order:number;budgetSeconds:number;focusSignalIds:string[];mandatory:boolean};
type DirectorPlan={id:string;routeId:string;sceneId:string;purpose:string;roundBudgetSeconds:number;completionRule:string;archetype:any;probePolicy:any;focusSignals:FocusSpec[];incidentalSignals?:string[];phases:PhaseSpec[]};

export const INTERVIEW_DIRECTOR_TOOL_CONTRACTS={
  'interview.director_prepare_session':{sideEffect:'WRITE_PLAN_SNAPSHOT',idempotentBy:'request_id',careerFactsMutable:false},
  'interview.director_decide':{sideEffect:'APPEND_DIRECTOR_DECISION',idempotentBy:'request_id+source_turn',careerFactsMutable:false},
  'interview.director_get_state':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'interview.director_finalize':{sideEffect:'WRITE_FINAL_SCORECARD',idempotentBy:'request_id',careerFactsMutable:false},
} as const;

function session(db:any,sessionId:string){const row:any=db.prepare('SELECT * FROM interview_sessions WHERE id=?').get(sessionId);if(!row) throw new Error('INTERVIEW_SESSION_NOT_FOUND');return row;}
function activeSession(db:any,sessionId:string){const row=session(db,sessionId);if(row.status!=='ACTIVE') throw new Error('INTERVIEW_SESSION_NOT_ACTIVE');return row;}
function existingRequest(db:any,requestId:string,operation:string){const row:any=db.prepare('SELECT operation,status,response_json FROM interview_idempotency_requests WHERE request_id=?').get(requestId);if(!row)return null;if(row.operation!==operation)throw new Error('REQUEST_ID_OPERATION_MISMATCH');if(row.status!=='APPLIED'||!row.response_json)throw new Error('REQUEST_ID_STATE_UNRECOVERABLE');return JSON.parse(row.response_json);}
function recordRequest(db:any,requestId:string,operation:string,sessionId:string,response:any,now:string){db.prepare("INSERT INTO interview_idempotency_requests(request_id,operation,session_id,status,response_json,created_at,updated_at) VALUES(?,?,?,'APPLIED',?,?,?)").run(requestId,operation,sessionId,JSON.stringify(response),now,now);}
function storedPlan(db:any,sessionId:string):DirectorPlan{const row:any=db.prepare('SELECT plan_json FROM interview_director_session_plans WHERE session_id=?').get(sessionId);if(!row)throw new Error('DIRECTOR_SESSION_PLAN_MISSING');return JSON.parse(row.plan_json);}
function orderedPhases(plan:DirectorPlan){return [...plan.phases].sort((a,b)=>a.order-b.order);}
function priorityRank(p:string){return p==='P0'?0:p==='P1'?1:2;}
function targetSatisfied(spec:FocusSpec,state:string){if(spec.targetState==='CONFIRMED')return state==='CONFIRMED'||state==='CLOSED';if(spec.targetState==='WEAKENED')return state==='WEAKENED'||state==='CLOSED';return state==='CLOSED';}
function validatePlan(db:any,s:any,plan:DirectorPlan){
  if(plan.routeId!==s.route_id)throw new Error('DIRECTOR_PLAN_ROUTE_MISMATCH');
  if(plan.sceneId!==s.scene_id)throw new Error('DIRECTOR_PLAN_SCENE_MISMATCH');
  if(!plan.id||!plan.purpose||!Number.isFinite(plan.roundBudgetSeconds)||plan.roundBudgetSeconds<=0)throw new Error('DIRECTOR_PLAN_INVALID');
  if(!Array.isArray(plan.focusSignals)||plan.focusSignals.length<1||plan.focusSignals.length>6)throw new Error('DIRECTOR_PLAN_FOCUS_INVALID');
  const signals=new Set((db.prepare("SELECT id FROM interview_signals WHERE lifecycle='ACTIVE'").all() as any[]).map(r=>r.id));
  const seenSignals=new Set<string>();
  for(const f of plan.focusSignals){if(!signals.has(f.signalId))throw new Error('DIRECTOR_PLAN_SIGNAL_NOT_FOUND');if(seenSignals.has(f.signalId))throw new Error('DIRECTOR_PLAN_DUPLICATE_SIGNAL');seenSignals.add(f.signalId);if(f.maxProbeDepth<0||f.minimumEvidenceCount<0)throw new Error('DIRECTOR_PLAN_FOCUS_INVALID');}
  if(!Array.isArray(plan.phases)||!plan.phases.length)throw new Error('DIRECTOR_PLAN_PHASE_INVALID');
  const ids=new Set<string>(),orders=new Set<number>();
  for(const p of plan.phases){if(!p.id||p.budgetSeconds<=0||ids.has(p.id)||orders.has(p.order))throw new Error('DIRECTOR_PLAN_PHASE_INVALID');ids.add(p.id);orders.add(p.order);for(const sig of p.focusSignalIds??[])if(!seenSignals.has(sig))throw new Error('DIRECTOR_PLAN_PHASE_SIGNAL_INVALID');}
}

export function prepareInterviewDirectorSession(db:any,input:{requestId:string;sessionId:string;plan?:DirectorPlan},now=new Date().toISOString()){
  const op='interview.director_prepare_session';const cached=existingRequest(db,input.requestId,op);if(cached)return cached;
  const s=activeSession(db,input.sessionId);const plan:any=input.plan??buildDefaultDirectorPlan({routeId:s.route_id,sceneId:s.scene_id});validatePlan(db,s,plan);
  if(db.prepare('SELECT 1 ok FROM interview_director_session_plans WHERE session_id=?').get(input.sessionId))throw new Error('DIRECTOR_PLAN_ALREADY_PREPARED');
  const planSource=input.plan?'EXPLICIT':'DEFAULT_ROUTE_SCENE';const currentPhaseId=orderedPhases(plan)[0].id;const response={sessionId:input.sessionId,missionId:plan.id,currentPhaseId,planVersion:'director.plan.v1',planSource};
  db.exec('BEGIN;');try{
    db.prepare('INSERT INTO interview_director_session_plans(session_id,plan_version,mission_id,plan_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(input.sessionId,'director.plan.v1',plan.id,JSON.stringify(plan),now,now);
    db.prepare("UPDATE interview_sessions SET strategy_version='strategy.director.v1',updated_at=? WHERE id=?").run(now,input.sessionId);
    recordRequest(db,input.requestId,op,input.sessionId,response,now);
    db.exec('COMMIT;');return response;
  }catch(e){try{db.exec('ROLLBACK;')}catch{}throw e;}
}

function latestDecision(db:any,sessionId:string){return db.prepare('SELECT * FROM interview_director_decisions WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(sessionId) as any;}
function currentPhase(plan:DirectorPlan,latest:any){const phases=orderedPhases(plan);if(latest?.action==='ADVANCE_PHASE'&&latest.next_phase_id)return phases.find(p=>p.id===latest.next_phase_id)??phases[0];if(latest?.phase_id)return phases.find(p=>p.id===latest.phase_id)??phases[0];return phases[0];}
function elapsedSeconds(s:any,now:string){const start=Date.parse(s.started_at??s.created_at);return Math.max(0,Math.floor((Date.parse(now)-start)/1000));}
function phaseWindow(plan:DirectorPlan,phaseId:string){let start=0;for(const p of orderedPhases(plan)){const end=start+p.budgetSeconds;if(p.id===phaseId)return {start,end};start=end;}return {start:0,end:plan.roundBudgetSeconds};}
function signalRows(db:any,sessionId:string){return new Map((db.prepare('SELECT signal_id,state,confidence,last_turn_id FROM interview_session_signals WHERE session_id=?').all(sessionId) as any[]).map(r=>[r.signal_id,r]));}
function incompleteSpecs(plan:DirectorPlan,phase:PhaseSpec,rows:Map<string,any>){return plan.focusSignals.filter(f=>(phase.focusSignalIds??[]).includes(f.signalId)&&!targetSatisfied(f,rows.get(f.signalId)?.state??'UNTESTED')).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)||a.signalId.localeCompare(b.signalId));}
function nextPhase(plan:DirectorPlan,phaseId:string){const phases=orderedPhases(plan);const i=phases.findIndex(p=>p.id===phaseId);return i>=0&&i+1<phases.length?phases[i+1]:null;}
function currentTurnSignal(db:any,sourceTurnId:string){const row:any=db.prepare(`SELECT f.primary_signal_id signal_id FROM interview_turns t LEFT JOIN interview_question_families f ON f.id=t.question_family_id WHERE t.id=?`).get(sourceTurnId);return row?.signal_id??null;}
function consecutiveSignalDecisions(db:any,sessionId:string,signalId:string){const rows:any[]=db.prepare('SELECT target_signal_id FROM interview_director_decisions WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 10').all(sessionId) as any[];let n=0;for(const r of rows){if(r.target_signal_id===signalId)n++;else break;}return n;}

export function getInterviewDirectorState(db:any,input:{sessionId:string},now=new Date().toISOString()){
  const s=session(db,input.sessionId);const plan=storedPlan(db,input.sessionId);const latest=latestDecision(db,input.sessionId);const phase=currentPhase(plan,latest);const elapsed=elapsedSeconds(s,now);const rows=signalRows(db,input.sessionId);
  return {sessionId:input.sessionId,missionId:plan.id,currentPhaseId:phase.id,elapsedSeconds:elapsed,remainingSeconds:Math.max(0,plan.roundBudgetSeconds-elapsed),coverage:plan.focusSignals.map(f=>({signalId:f.signalId,priority:f.priority,required:f.required,targetState:f.targetState,state:rows.get(f.signalId)?.state??'UNTESTED',confidence:rows.get(f.signalId)?.confidence??null,sufficient:targetSatisfied(f,rows.get(f.signalId)?.state??'UNTESTED')}))};
}

export function decideInterviewDirector(db:any,input:{requestId:string;sessionId:string;sourceTurnId:string;explicitUnknown?:boolean;reasoningChallenge?:'SCRIPTED_PATTERN';hypothesisUpdate?:{statement:string;confidence?:number};hypothesisResolution?:{hypothesisId:string;outcome:'CONFIRMED'|'REJECTED'|'CLOSED'}},now=new Date().toISOString()){
  const op='interview.director_decide';const cached=existingRequest(db,input.requestId,op);if(cached)return cached;
  const s=activeSession(db,input.sessionId);const turn:any=db.prepare('SELECT id FROM interview_turns WHERE id=? AND session_id=?').get(input.sourceTurnId,input.sessionId);if(!turn)throw new Error('INTERVIEW_TURN_NOT_FOUND');
  if(db.prepare('SELECT 1 ok FROM interview_director_decisions WHERE session_id=? AND source_turn_id=?').get(input.sessionId,input.sourceTurnId))throw new Error('DIRECTOR_SOURCE_TURN_ALREADY_DECIDED');
  const plan=storedPlan(db,input.sessionId), latest=latestDecision(db,input.sessionId), phase=currentPhase(plan,latest), rows=signalRows(db,input.sessionId), elapsed=elapsedSeconds(s,now), remaining=Math.max(0,plan.roundBudgetSeconds-elapsed), following=nextPhase(plan,phase.id);
  let action:DirectorAction='RECOVER',targetSignalId:string|undefined,hypothesisId:string|undefined,claimDebtId:string|undefined,nextPhaseId:string|undefined;const reasonCodes:string[]=[];
  const highTruthRisk:any=db.prepare("SELECT id,risk_key,severity FROM interview_session_risks WHERE session_id=? AND status IN ('OPEN','REOPENED') AND severity IN ('HIGH','FATAL') AND risk_key LIKE 'truth.%' ORDER BY CASE severity WHEN 'FATAL' THEN 2 ELSE 1 END DESC,updated_at DESC LIMIT 1").get(input.sessionId);
  const strong:any=db.prepare("SELECT id FROM interview_claim_debts WHERE session_id=? AND status IN ('OPEN','PARTIALLY_VERIFIED') AND strength='STRONG' ORDER BY CASE WHEN source_turn_id=? THEN 0 ELSE 1 END,created_at DESC LIMIT 1").get(input.sessionId,input.sourceTurnId);
  let resolution:any=null;
  if(input.hypothesisResolution){resolution=db.prepare("SELECT id FROM interview_session_hypotheses WHERE id=? AND session_id=? AND status='ACTIVE'").get(input.hypothesisResolution.hypothesisId,input.sessionId);if(!resolution)throw new Error('DIRECTOR_HYPOTHESIS_NOT_ACTIVE');}
  let hypothesis:any=db.prepare("SELECT id FROM interview_session_hypotheses WHERE session_id=? AND status='ACTIVE' AND (? IS NULL OR id!=?) ORDER BY updated_at DESC LIMIT 1").get(input.sessionId,input.hypothesisResolution?.hypothesisId??null,input.hypothesisResolution?.hypothesisId??null);
  const supersedeId=input.hypothesisUpdate&&hypothesis?.id?hypothesis.id:null;
  const newHypothesisId=input.hypothesisUpdate?`hypothesis.${randomUUID()}`:null;
  if(newHypothesisId)hypothesis={id:newHypothesisId};
  if(highTruthRisk){action='CROSS_CHECK_CLAIM';targetSignalId=plan.focusSignals.some(f=>f.signalId==='signal.truthfulness')?'signal.truthfulness':plan.focusSignals.some(f=>f.signalId==='signal.risk')?'signal.risk':currentTurnSignal(db,input.sourceTurnId)??undefined;reasonCodes.push('HIGH_TRUTH_RISK_REQUIRES_EVIDENCE');}
  else if(strong){action='CROSS_CHECK_CLAIM';claimDebtId=strong.id;targetSignalId=currentTurnSignal(db,input.sourceTurnId)??undefined;reasonCodes.push('STRONG_CLAIM_UNVERIFIED');}
  else if(hypothesis){action='CROSS_CHECK_CLAIM';hypothesisId=hypothesis.id;targetSignalId=currentTurnSignal(db,input.sourceTurnId)??undefined;reasonCodes.push('HYPOTHESIS_NEEDS_CROSSCHECK');}
  else if(elapsed>=plan.roundBudgetSeconds){action='CLOSE_ROUND';reasonCodes.push('ROUND_HARD_BUDGET_EXCEEDED');}
  else if(input.explicitUnknown&&plan.probePolicy?.stopOnExplicitUnknown!==false){const remainingSpecs=incompleteSpecs(plan,phase,rows).filter(f=>f.signalId!==currentTurnSignal(db,input.sourceTurnId));if(remainingSpecs[0]){action='PIVOT_TOPIC';targetSignalId=remainingSpecs[0].signalId;}else if(following){action='ADVANCE_PHASE';nextPhaseId=following.id;}else action='CLOSE_ROUND';reasonCodes.push('EXPLICIT_UNKNOWN_NO_NEW_SIGNAL');}
  else {
    const window=phaseWindow(plan,phase.id);const phaseIncomplete=incompleteSpecs(plan,phase,rows);
    if(elapsed>=window.end){action=following?'ADVANCE_PHASE':'CLOSE_ROUND';nextPhaseId=following?.id;reasonCodes.push('PHASE_HARD_BUDGET_EXCEEDED');}
    else if(input.reasoningChallenge==='SCRIPTED_PATTERN'){targetSignalId=currentTurnSignal(db,input.sourceTurnId)??phaseIncomplete[0]?.signalId;action='CHALLENGE_TRADEOFF';reasonCodes.push('SCRIPTED_PATTERN_CONSTRAINT_CHANGE');}
    else if(!phaseIncomplete.length){action=following?'ADVANCE_PHASE':'CLOSE_ROUND';nextPhaseId=following?.id;reasonCodes.push('CURRENT_PHASE_FOCUS_SUFFICIENT');}
    else {const f=phaseIncomplete[0],state=rows.get(f.signalId)?.state??'UNTESTED';targetSignalId=f.signalId;if(state==='PROBING'){const depth=consecutiveSignalDecisions(db,input.sessionId,f.signalId);if(depth>=Math.min(f.maxProbeDepth,Number(plan.probePolicy?.maxConsecutiveSameSignal??f.maxProbeDepth))){action=following?'ADVANCE_PHASE':'PIVOT_TOPIC';nextPhaseId=following?.id;reasonCodes.push('PROBE_DEPTH_LIMIT_REACHED');}else{action='PROBE_DEPTH';reasonCodes.push(`${f.priority}_SIGNAL_PROBING`);}}else{action='PIVOT_TOPIC';reasonCodes.push(`${f.priority}_SIGNAL_UNTESTED`);}}
  }
  if(action==='ADVANCE_PHASE'&&nextPhaseId&&!targetSignalId){
    let targetPhase=orderedPhases(plan).find(p=>p.id===nextPhaseId);
    while(targetPhase){
      const incomplete=incompleteSpecs(plan,targetPhase,rows);
      if(!(targetPhase.focusSignalIds??[]).length)break;
      if(incomplete[0]){targetSignalId=incomplete[0].signalId;break;}
      const later=nextPhase(plan,targetPhase.id);if(!later)break;
      reasonCodes.push('NEXT_PHASE_FOCUS_ALREADY_SUFFICIENT');nextPhaseId=later.id;targetPhase=later;
    }
  }
  const decision={id:`director.${randomUUID()}`,sessionId:input.sessionId,sourceTurnId:input.sourceTurnId,phaseId:phase.id,action,targetSignalId:targetSignalId??null,preferredFamilyId:null,hypothesisId:hypothesisId??null,claimDebtId:claimDebtId??null,reasonCodes,elapsedSeconds:elapsed,remainingSeconds:remaining,nextPhaseId:nextPhaseId??null};
  db.exec('BEGIN;');try{
    if(resolution)db.prepare('UPDATE interview_session_hypotheses SET status=?,updated_at=? WHERE id=?').run(input.hypothesisResolution!.outcome,now,resolution.id);
    if(supersedeId)db.prepare("UPDATE interview_session_hypotheses SET status='SUPERSEDED',updated_at=? WHERE id=?").run(now,supersedeId);
    if(newHypothesisId)db.prepare("INSERT INTO interview_session_hypotheses(id,session_id,statement,confidence,status,source_turn_id,created_at,updated_at) VALUES(?,?,?,?, 'ACTIVE',?,?,?)").run(newHypothesisId,input.sessionId,input.hypothesisUpdate!.statement,input.hypothesisUpdate!.confidence??null,input.sourceTurnId,now,now);
    db.prepare(`INSERT INTO interview_director_decisions(id,session_id,source_turn_id,phase_id,action,target_signal_id,preferred_family_id,hypothesis_id,claim_debt_id,reason_codes_json,elapsed_seconds,remaining_seconds,next_phase_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(decision.id,input.sessionId,input.sourceTurnId,phase.id,action,decision.targetSignalId,null,decision.hypothesisId,decision.claimDebtId,JSON.stringify(reasonCodes),elapsed,remaining,decision.nextPhaseId,now);recordRequest(db,input.requestId,op,input.sessionId,decision,now);db.exec('COMMIT;');return decision;
  }catch(e){try{db.exec('ROLLBACK;')}catch{}throw e;}
}

function evidenceTurns(db:any,sessionId:string,signalId:string,lastTurnId:string|null){const ids=(db.prepare(`SELECT t.id FROM interview_turns t JOIN interview_question_families f ON f.id=t.question_family_id WHERE t.session_id=? AND f.primary_signal_id=? ORDER BY t.turn_index`).all(sessionId,signalId) as any[]).map(r=>r.id);if(lastTurnId&&!ids.includes(lastTurnId))ids.push(lastTurnId);return ids;}
export function finalizeInterviewDirectorRound(db:any,input:{requestId:string;sessionId:string},now=new Date().toISOString()){
  const op='interview.director_finalize';const cached=existingRequest(db,input.requestId,op);if(cached)return cached;session(db,input.sessionId);const plan=storedPlan(db,input.sessionId);if(db.prepare('SELECT 1 ok FROM interview_round_scorecards WHERE session_id=?').get(input.sessionId))throw new Error('DIRECTOR_SCORECARD_ALREADY_FINAL');const rows=signalRows(db,input.sessionId);
  const items=plan.focusSignals.map(f=>{const r:any=rows.get(f.signalId)??{state:'UNTESTED',confidence:null,last_turn_id:null};const verdict=r.state==='CONFIRMED'?'MEETS':r.state==='WEAKENED'?'WEAK':r.state==='CLOSED'?(r.confidence!=null?'MIXED':'INSUFFICIENT'):'INSUFFICIENT';return {signalId:f.signalId,verdict,confidence:r.confidence??0,evidenceTurnIds:evidenceTurns(db,input.sessionId,f.signalId,r.last_turn_id??null),positiveAnchorIds:[],negativeAnchorIds:[],residualRiskIds:[]};});
  const required=items.filter((_,i)=>plan.focusSignals[i].required);let verdict='INSUFFICIENT';if(required.some(x=>x.verdict==='WEAK'))verdict='NO_HIRE_SIGNAL';else if(required.length&&required.every(x=>x.verdict==='MEETS'))verdict='HIRE_SIGNAL';else if(required.some(x=>x.verdict==='MEETS'||x.verdict==='MIXED'))verdict='MIXED';
  const scorecard={sessionId:input.sessionId,missionId:plan.id,verdict,items};db.exec('BEGIN;');try{db.prepare('INSERT INTO interview_round_scorecards(session_id,verdict,scorecard_json,created_at) VALUES(?,?,?,?)').run(input.sessionId,verdict,JSON.stringify(scorecard),now);recordRequest(db,input.requestId,op,input.sessionId,scorecard,now);db.exec('COMMIT;');return scorecard;}catch(e){try{db.exec('ROLLBACK;')}catch{}throw e;}
}
