import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { startInterviewSession, nextInterviewTurn, observeInterviewAnswer } from '../server/interview-voice-runtime.ts';
import {
  INTERVIEW_DIRECTOR_TOOL_CONTRACTS,
  prepareInterviewDirectorSession,
  decideInterviewDirector,
  getInterviewDirectorState,
  finalizeInterviewDirectorRound,
} from '../server/interview-director.ts';

const T0='2026-09-08T03:00:00.000Z';
const plan={
  id:'mission.ai.tech1.v1', routeId:'route.ai-agent-devtools', sceneId:'scene.tech1', purpose:'验证 Agent 工程下限与真实性',
  roundBudgetSeconds:3300, completionRule:'MANDATORY_PHASES_AND_FOCUS',
  archetype:{id:'archetype.engineer-screen',roleName:'Engineer',pressureBand:'MEDIUM',hintPolicy:'BOUNDED',interruptionPolicy:'TIMEBOXED'},
  probePolicy:{id:'probe.tech1.v1',maxConsecutiveSameSignal:2,maxConsecutiveSameFamily:2,stopOnExplicitUnknown:true},
  focusSignals:[
    {signalId:'signal.baseline',priority:'P0',required:true,targetState:'CONFIRMED',minimumEvidenceCount:1,maxProbeDepth:3},
    {signalId:'signal.truthfulness',priority:'P0',required:true,targetState:'CONFIRMED',minimumEvidenceCount:1,maxProbeDepth:2},
    {signalId:'signal.judgment',priority:'P1',required:true,targetState:'CONFIRMED',minimumEvidenceCount:1,maxProbeDepth:2},
  ],
  incidentalSignals:['signal.failure'],
  phases:[
    {id:'PROJECT_ANCHOR',order:1,budgetSeconds:600,focusSignalIds:['signal.truthfulness'],mandatory:true},
    {id:'AGENT_TECHNICAL',order:2,budgetSeconds:1500,focusSignalIds:['signal.baseline','signal.judgment'],mandatory:true},
    {id:'CANDIDATE_QUESTIONS',order:3,budgetSeconds:300,focusSignalIds:[],mandatory:true},
  ]
};
function setup(){
  const db=openDatabase(':memory:');
  const s=startInterviewSession(db,{requestId:'start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},T0);
  return {db,sessionId:s.sessionId};
}
function prepare(db:any,sessionId:string){return prepareInterviewDirectorSession(db,{requestId:'prepare',sessionId,plan},T0);}

test('TP-DIR3-001 director tool surface is bounded and never mutates Career Facts',()=>{
  assert.deepEqual(Object.keys(INTERVIEW_DIRECTOR_TOOL_CONTRACTS).sort(),[
    'interview.director_decide','interview.director_finalize','interview.director_get_state','interview.director_prepare_session'
  ]);
  assert.ok(Object.values(INTERVIEW_DIRECTOR_TOOL_CONTRACTS).every((x:any)=>x.careerFactsMutable===false));
});

test('TP-DIR3-002 migration 006 creates only the three Director persistence tables',()=>{
  const db=openDatabase(':memory:'); try{
    const names=(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'interview_director_%' OR name='interview_round_scorecards'").all() as any[]).map(x=>x.name).sort();
    assert.deepEqual(names,['interview_director_decisions','interview_director_session_plans','interview_round_scorecards']);
    const all=(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(x=>x.name).join('\n');
    assert.doesNotMatch(all,/director_(signal|question|evidence|growth|hypoth)/i);
  } finally {db.close();}
});

test('TP-DIR3-003 prepare freezes a validated plan and exact retry is idempotent',()=>{
  const {db,sessionId}=setup(); try{
    const a=prepare(db,sessionId); const b=prepare(db,sessionId);
    assert.deepEqual(b,a); assert.equal(a.currentPhaseId,'PROJECT_ANCHOR');
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM interview_director_session_plans WHERE session_id=?').get(sessionId) as any).c),1);
    assert.throws(()=>prepareInterviewDirectorSession(db,{requestId:'bad',sessionId,plan:{...plan,routeId:'route.tob-fde'}},T0),/DIRECTOR_PLAN_ROUTE_MISMATCH/);
  } finally {db.close();}
});

test('TP-DIR3-004 P0 UNTESTED emits one explainable PIVOT_TOPIC and sourceTurn is unique',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next1',sessionId},'2026-09-08T03:00:10.000Z');
    observeInterviewAnswer(db,{requestId:'obs1',sessionId,turnId:turn.turnId,answerObservation:{summary:'回答完成'}},'2026-09-08T03:00:40.000Z');
    const a=decideInterviewDirector(db,{requestId:'dec1',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:00:40.000Z');
    const b=decideInterviewDirector(db,{requestId:'dec1',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:00:50.000Z');
    assert.deepEqual(b,a); assert.equal(a.action,'PIVOT_TOPIC'); assert.equal(a.targetSignalId,'signal.truthfulness');
    assert.ok(a.reasonCodes.includes('P0_SIGNAL_UNTESTED'));
    assert.throws(()=>decideInterviewDirector(db,{requestId:'dec2',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:01:00.000Z'),/DIRECTOR_SOURCE_TURN_ALREADY_DECIDED/);
  } finally {db.close();}
});

test('TP-DIR3-005 unresolved strong Claim outranks normal focus probing',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next2',sessionId},'2026-09-08T03:01:00.000Z');
    observeInterviewAnswer(db,{requestId:'obs2',sessionId,turnId:turn.turnId,answerObservation:{detectedClaims:[{text:'我主导了 Tool 写操作重试设计',strength:'STRONG'}]}},'2026-09-08T03:01:30.000Z');
    const d=decideInterviewDirector(db,{requestId:'dec3',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:01:30.000Z');
    assert.equal(d.action,'CROSS_CHECK_CLAIM'); assert.ok(d.claimDebtId); assert.ok(d.reasonCodes.includes('STRONG_CLAIM_UNVERIFIED'));
  } finally {db.close();}
});

test('TP-DIR3-006 PROBING permits bounded depth; explicit unknown stops same-signal drilling',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next3',sessionId},'2026-09-08T03:02:00.000Z');
    observeInterviewAnswer(db,{requestId:'obs3',sessionId,turnId:turn.turnId,answerObservation:{signalUpdate:{signalId:'signal.truthfulness',state:'PROBING',confidence:.5}}},'2026-09-08T03:02:20.000Z');
    const probe=decideInterviewDirector(db,{requestId:'dec4',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:02:20.000Z');
    assert.equal(probe.action,'PROBE_DEPTH');
    const turn2=nextInterviewTurn(db,{requestId:'next4',sessionId,desiredAction:'FOLLOW_UP'},'2026-09-08T03:02:40.000Z');
    observeInterviewAnswer(db,{requestId:'obs4',sessionId,turnId:turn2.turnId,answerObservation:{summary:'明确不知道'}},'2026-09-08T03:03:00.000Z');
    const stop=decideInterviewDirector(db,{requestId:'dec5',sessionId,sourceTurnId:turn2.turnId,explicitUnknown:true},'2026-09-08T03:03:00.000Z');
    assert.notEqual(stop.action,'PROBE_DEPTH'); assert.ok(stop.reasonCodes.includes('EXPLICIT_UNKNOWN_NO_NEW_SIGNAL'));
  } finally {db.close();}
});

test('TP-DIR3-007 completed phase focus advances phase instead of repeating questions',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    db.prepare("UPDATE interview_session_signals SET state='CONFIRMED',confidence=.9 WHERE session_id=? AND signal_id='signal.truthfulness'").run(sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next5',sessionId},'2026-09-08T03:04:00.000Z');
    const d=decideInterviewDirector(db,{requestId:'dec6',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:04:05.000Z');
    assert.equal(d.action,'ADVANCE_PHASE'); assert.equal(d.nextPhaseId,'AGENT_TECHNICAL'); assert.ok(d.reasonCodes.includes('CURRENT_PHASE_FOCUS_SUFFICIENT'));
  } finally {db.close();}
});

test('TP-DIR3-008 hard timebox advances or closes without opening a new deep chain',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next6',sessionId},'2026-09-08T03:10:01.000Z');
    const d=decideInterviewDirector(db,{requestId:'dec7',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:10:01.000Z');
    assert.equal(d.action,'ADVANCE_PHASE'); assert.equal(d.nextPhaseId,'AGENT_TECHNICAL'); assert.ok(d.reasonCodes.includes('PHASE_HARD_BUDGET_EXCEEDED'));
  } finally {db.close();}
});

test('TP-DIR3-009 get_state exposes mission/phase/coverage but no hidden question text',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const state=getInterviewDirectorState(db,{sessionId},'2026-09-08T03:05:00.000Z');
    assert.equal(state.currentPhaseId,'PROJECT_ANCHOR'); assert.equal(state.missionId,plan.id);
    assert.equal(state.coverage.length,3); assert.equal('primaryQuestion' in state,false);
  } finally {db.close();}
});

test('TP-DIR3-010 finalize creates one evidence-grounded scorecard and does not invent anchors',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next7',sessionId},'2026-09-08T03:06:00.000Z');
    observeInterviewAnswer(db,{requestId:'obs7',sessionId,turnId:turn.turnId,answerObservation:{signalUpdate:{signalId:'signal.truthfulness',state:'CONFIRMED',confidence:.9}}},'2026-09-08T03:06:30.000Z');
    const before=Number((db.prepare('SELECT COUNT(*) c FROM interview_evidence_refs').get() as any).c);
    const a=finalizeInterviewDirectorRound(db,{requestId:'final1',sessionId},'2026-09-08T03:07:00.000Z');
    const b=finalizeInterviewDirectorRound(db,{requestId:'final1',sessionId},'2026-09-08T03:07:10.000Z');
    assert.deepEqual(b,a); assert.equal(a.items.find((x:any)=>x.signalId==='signal.truthfulness').verdict,'MEETS');
    assert.deepEqual(a.items.find((x:any)=>x.signalId==='signal.truthfulness').positiveAnchorIds,[]);
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM interview_evidence_refs').get() as any).c),before);
  } finally {db.close();}
});

test('TP-DIR3-011 hypothesis create/resolve lifecycle is atomic with Director decisions',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next8',sessionId},'2026-09-08T03:08:00.000Z');
    const probe=decideInterviewDirector(db,{requestId:'dec8',sessionId,sourceTurnId:turn.turnId,hypothesisUpdate:{statement:'候选人本人承担了关键 Tool Contract 设计',confidence:.55}},'2026-09-08T03:08:10.000Z');
    assert.equal(probe.action,'CROSS_CHECK_CLAIM'); assert.ok(probe.hypothesisId); assert.ok(probe.reasonCodes.includes('HYPOTHESIS_NEEDS_CROSSCHECK'));
    assert.equal((db.prepare('SELECT status FROM interview_session_hypotheses WHERE id=?').get(probe.hypothesisId) as any).status,'ACTIVE');
    const turn2=nextInterviewTurn(db,{requestId:'next9',sessionId,desiredAction:'CHALLENGE'},'2026-09-08T03:08:20.000Z');
    const resolved=decideInterviewDirector(db,{requestId:'dec9',sessionId,sourceTurnId:turn2.turnId,hypothesisResolution:{hypothesisId:probe.hypothesisId,outcome:'CONFIRMED'}},'2026-09-08T03:08:30.000Z');
    assert.equal((db.prepare('SELECT status FROM interview_session_hypotheses WHERE id=?').get(probe.hypothesisId) as any).status,'CONFIRMED');
    assert.notEqual(resolved.hypothesisId,probe.hypothesisId);
  } finally {db.close();}
});

test('TP-DIR3-012 plan/decision/scorecard snapshots reject update and delete',()=>{
  const {db,sessionId}=setup(); try{
    prepare(db,sessionId);
    const turn=nextInterviewTurn(db,{requestId:'next10',sessionId},'2026-09-08T03:09:00.000Z');
    decideInterviewDirector(db,{requestId:'dec10',sessionId,sourceTurnId:turn.turnId},'2026-09-08T03:09:10.000Z');
    finalizeInterviewDirectorRound(db,{requestId:'final2',sessionId},'2026-09-08T03:09:20.000Z');
    assert.throws(()=>db.prepare('UPDATE interview_director_session_plans SET mission_id=? WHERE session_id=?').run('x',sessionId),/DIRECTOR_PLAN_APPEND_ONLY/);
    assert.throws(()=>db.prepare('DELETE FROM interview_director_decisions WHERE session_id=?').run(sessionId),/DIRECTOR_DECISION_APPEND_ONLY/);
    assert.throws(()=>db.prepare('UPDATE interview_round_scorecards SET verdict=? WHERE session_id=?').run('MIXED',sessionId),/DIRECTOR_SCORECARD_FINAL/);
  } finally {db.close();}
});
