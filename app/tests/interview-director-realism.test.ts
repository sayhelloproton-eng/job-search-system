import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../server/db.ts';
import { startInterviewSession, nextInterviewTurn, observeInterviewAnswer } from '../server/interview-voice-runtime.ts';
import { prepareInterviewDirectorSession, decideInterviewDirector } from '../server/interview-director.ts';
import { buildDefaultDirectorPlan } from '../server/interview-director-profiles.ts';
import { createInterviewRuntimeHost } from '../server/interview-runtime-host.ts';
import { DIRECTOR_REALISM_FIXTURE_CATALOG_V1, projectDirectorSemanticDecision, summarizeDirectorRealism } from '../server/interview-director-realism-eval.ts';

const T0='2026-09-09T00:00:00.000Z';
const focus=(signalId:string,priority:'P0'|'P1'='P0',maxProbeDepth=2)=>({signalId,priority,required:true,targetState:'CONFIRMED' as const,minimumEvidenceCount:1,maxProbeDepth});
function planFor(routeId:string,sceneId:string,signals:any[],phases?:any[]){
  return {id:`mission.realism.${routeId}.${sceneId}`,routeId,sceneId,purpose:'P6-6 deterministic realism fixture',roundBudgetSeconds:1200,completionRule:'MANDATORY_PHASES_AND_FOCUS',archetype:{id:'eval',roleName:'Evaluator',pressureBand:'MEDIUM',hintPolicy:'BOUNDED',interruptionPolicy:'TIMEBOXED'},probePolicy:{id:'eval.probe',maxConsecutiveSameSignal:2,maxConsecutiveSameFamily:2,stopOnExplicitUnknown:true,antiScriptAfterStrongClaim:true},focusSignals:signals,incidentalSignals:[],phases:phases??[{id:'PRIMARY',order:1,budgetSeconds:1200,focusSignalIds:signals.map(x=>x.signalId),mandatory:true}]};
}
function setup(routeId='route.ai-agent-devtools',sceneId='scene.tech1',plan:any=planFor(routeId,sceneId,[focus('signal.truthfulness')])){
  const db=openDatabase(':memory:');
  const s=startInterviewSession(db,{requestId:`start.${routeId}.${sceneId}`,mode:'TEXT',routeId,sceneId},T0);
  prepareInterviewDirectorSession(db,{requestId:`prepare.${routeId}.${sceneId}`,sessionId:s.sessionId,plan},T0);
  return {db,sessionId:s.sessionId,plan};
}
async function withHost(fn:(base:string,host:any)=>Promise<void>){const host=createInterviewRuntimeHost({dbPath:':memory:'});host.server.listen(0,'127.0.0.1');await once(host.server,'listening');const addr:any=host.server.address();try{await fn(`http://127.0.0.1:${addr.port}`,host);}finally{await host.close();}}
async function post(base:string,path:string,body:any){return await (await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();}

test('TP-DIR6-001 strong answer stops same-signal probing and skips already-satisfied phases',()=>{
  const {db,sessionId}=setup();try{
    const turn=nextInterviewTurn(db,{requestId:'r1.next',sessionId,targetSignalId:'signal.truthfulness'},'2026-09-09T00:00:10.000Z');
    observeInterviewAnswer(db,{requestId:'r1.obs',sessionId,turnId:turn.turnId,answerObservation:{signalUpdate:{signalId:'signal.truthfulness',state:'CONFIRMED',confidence:.95}}},'2026-09-09T00:00:30.000Z');
    const d=decideInterviewDirector(db,{requestId:'r1.dec',sessionId,sourceTurnId:turn.turnId},'2026-09-09T00:00:30.000Z');
    assert.notEqual(d.action,'PROBE_DEPTH'); assert.equal(d.action,'CLOSE_ROUND'); assert.ok(d.reasonCodes.includes('CURRENT_PHASE_FOCUS_SUFFICIENT'));
  }finally{db.close();}

  const p=planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.truthfulness'),focus('signal.judgment','P1')],[{id:'A',order:1,budgetSeconds:400,focusSignalIds:['signal.truthfulness'],mandatory:true},{id:'B',order:2,budgetSeconds:400,focusSignalIds:['signal.judgment'],mandatory:true},{id:'CANDIDATE_QUESTIONS',order:3,budgetSeconds:400,focusSignalIds:[],mandatory:true}]);
  const skipped=setup('route.ai-agent-devtools','scene.tech1',p);try{
    skipped.db.prepare("UPDATE interview_session_signals SET state='CONFIRMED',confidence=.9 WHERE session_id=? AND signal_id='signal.judgment'").run(skipped.sessionId);
    const turn=nextInterviewTurn(skipped.db,{requestId:'r1.skip.next',sessionId:skipped.sessionId,targetSignalId:'signal.truthfulness'},'2026-09-09T00:00:10.000Z');
    observeInterviewAnswer(skipped.db,{requestId:'r1.skip.obs',sessionId:skipped.sessionId,turnId:turn.turnId,answerObservation:{signalUpdate:{signalId:'signal.truthfulness',state:'CONFIRMED',confidence:.95}}},'2026-09-09T00:00:30.000Z');
    const d=decideInterviewDirector(skipped.db,{requestId:'r1.skip.dec',sessionId:skipped.sessionId,sourceTurnId:turn.turnId},'2026-09-09T00:00:30.000Z');
    assert.equal(d.action,'ADVANCE_PHASE'); assert.equal(d.nextPhaseId,'CANDIDATE_QUESTIONS'); assert.equal(d.targetSignalId,null); assert.ok(d.reasonCodes.includes('NEXT_PHASE_FOCUS_ALREADY_SUFFICIENT'));
  }finally{skipped.db.close();}
});

test('TP-DIR6-002 vague team ownership opens a falsifiable ownership cross-check',()=>{
  const p=planFor('route.advanced-fe-fullstack','scene.deep-dive',[focus('signal.ownership')]);const {db,sessionId}=setup('route.advanced-fe-fullstack','scene.deep-dive',p);try{
    const turn=nextInterviewTurn(db,{requestId:'r2.next',sessionId,targetSignalId:'signal.ownership'},'2026-09-09T00:01:00.000Z');
    observeInterviewAnswer(db,{requestId:'r2.obs',sessionId,turnId:turn.turnId,answerObservation:{summary:'我们把多个仓迁完了。'}},'2026-09-09T00:01:20.000Z');
    const d=decideInterviewDirector(db,{requestId:'r2.dec',sessionId,sourceTurnId:turn.turnId,hypothesisUpdate:{statement:'候选人本人承担迁移决策与失败收尾',confidence:.5}},'2026-09-09T00:01:20.000Z');
    assert.equal(d.action,'CROSS_CHECK_CLAIM'); assert.ok(d.hypothesisId); assert.ok(d.reasonCodes.includes('HYPOTHESIS_NEEDS_CROSSCHECK'));
  }finally{db.close();}
});

test('TP-DIR6-003 strong metric claim without baseline is cross-checked before ordinary coverage',()=>{
  const p=planFor('route.ai-agent-devtools','scene.hm',[focus('signal.value')]);const {db,sessionId}=setup('route.ai-agent-devtools','scene.hm',p);try{
    const turn=nextInterviewTurn(db,{requestId:'r3.next',sessionId,targetSignalId:'signal.value'},'2026-09-09T00:02:00.000Z');
    observeInterviewAnswer(db,{requestId:'r3.obs',sessionId,turnId:turn.turnId,answerObservation:{detectedClaims:[{text:'把研发效率提升了 80%',strength:'STRONG'}]}},'2026-09-09T00:02:20.000Z');
    const d=decideInterviewDirector(db,{requestId:'r3.dec',sessionId,sourceTurnId:turn.turnId},'2026-09-09T00:02:20.000Z');
    assert.equal(d.action,'CROSS_CHECK_CLAIM'); assert.ok(d.claimDebtId); assert.ok(d.reasonCodes.includes('STRONG_CLAIM_UNVERIFIED'));
  }finally{db.close();}
});

test('TP-DIR6-004 HIGH truth contradiction outranks ordinary P0 coverage',()=>{
  const {db,sessionId}=setup();try{
    const turn=nextInterviewTurn(db,{requestId:'r4.next',sessionId,targetSignalId:'signal.truthfulness'},'2026-09-09T00:03:00.000Z');
    observeInterviewAnswer(db,{requestId:'r4.obs',sessionId,turnId:turn.turnId,answerObservation:{riskUpdate:{riskKey:'truth.contradiction',summary:'前后对本人 ownership 的描述矛盾',severity:'HIGH',status:'OPEN'}}},'2026-09-09T00:03:20.000Z');
    const d=decideInterviewDirector(db,{requestId:'r4.dec',sessionId,sourceTurnId:turn.turnId},'2026-09-09T00:03:20.000Z');
    assert.equal(d.action,'CROSS_CHECK_CLAIM'); assert.equal(d.targetSignalId,'signal.truthfulness'); assert.ok(d.reasonCodes.includes('HIGH_TRUTH_RISK_REQUIRES_EVIDENCE'));
  }finally{db.close();}
});

test('TP-DIR6-005 explicit unknown never repeats the same-signal depth probe',()=>{
  const p=planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.truthfulness'),focus('signal.judgment','P1')]);const {db,sessionId}=setup('route.ai-agent-devtools','scene.tech1',p);try{
    const turn=nextInterviewTurn(db,{requestId:'r5.next',sessionId,targetSignalId:'signal.truthfulness'},'2026-09-09T00:04:00.000Z');
    observeInterviewAnswer(db,{requestId:'r5.obs',sessionId,turnId:turn.turnId,answerObservation:{summary:'这个我明确不知道。'}},'2026-09-09T00:04:20.000Z');
    const d=decideInterviewDirector(db,{requestId:'r5.dec',sessionId,sourceTurnId:turn.turnId,explicitUnknown:true},'2026-09-09T00:04:20.000Z');
    assert.notEqual(d.action,'PROBE_DEPTH'); assert.ok(d.reasonCodes.includes('EXPLICIT_UNKNOWN_NO_NEW_SIGNAL'));
  }finally{db.close();}
});

test('TP-DIR6-006 scripted-pattern cue changes constraint instead of scoring the candidate down',async()=>{
  await withHost(async(base,host)=>{
    const p=planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.judgment')]);
    const s:any=(await post(base,'/tool',{op:'interview.start_session',input:{requestId:'r6.start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}})).result;
    await post(base,'/tool',{op:'interview.director_prepare_session',input:{requestId:'r6.prepare',sessionId:s.sessionId,plan:p}});
    const turn:any=(await post(base,'/tool',{op:'interview.next_turn',input:{requestId:'r6.next',sessionId:s.sessionId,targetSignalId:'signal.judgment'}})).result;
    const body:any=await post(base,'/interview/continue',{observeRequestId:'r6.obs',directorRequestId:'r6.dec',nextRequestId:'r6.next2',sessionId:s.sessionId,turnId:turn.turnId,reasoningChallenge:'SCRIPTED_PATTERN',answerObservation:{signalUpdate:{signalId:'signal.judgment',state:'PROBING',confidence:.6}}});
    const stored:any=host.db.prepare("SELECT state,confidence FROM interview_session_signals WHERE session_id=? AND signal_id='signal.judgment'").get(s.sessionId);
    assert.equal(body.result.director.action,'CHALLENGE_TRADEOFF'); assert.ok(body.result.director.reasonCodes.includes('SCRIPTED_PATTERN_CONSTRAINT_CHANGE')); assert.equal(body.result.next.turnIntent,'CHALLENGE'); assert.equal(stored.state,'PROBING'); assert.equal(stored.confidence,.6);
  });
});

test('TP-DIR6-007 hard phase budget advances without starting another depth probe',()=>{
  const p=planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.truthfulness'),focus('signal.judgment','P1')],[{id:'A',order:1,budgetSeconds:60,focusSignalIds:['signal.truthfulness'],mandatory:true},{id:'B',order:2,budgetSeconds:1140,focusSignalIds:['signal.judgment'],mandatory:true}]);const {db,sessionId}=setup('route.ai-agent-devtools','scene.tech1',p);try{
    const turn=nextInterviewTurn(db,{requestId:'r7.next',sessionId,targetSignalId:'signal.truthfulness'},'2026-09-09T00:01:01.000Z');
    const d=decideInterviewDirector(db,{requestId:'r7.dec',sessionId,sourceTurnId:turn.turnId},'2026-09-09T00:01:01.000Z');
    assert.equal(d.action,'ADVANCE_PHASE'); assert.equal(d.nextPhaseId,'B'); assert.ok(d.reasonCodes.includes('PHASE_HARD_BUDGET_EXCEEDED'));
  }finally{db.close();}
});

function firstFocusedDecision(routeId:string,sceneId:string,prefix:string){
  const db=openDatabase(':memory:');try{
    const plan:any=buildDefaultDirectorPlan({routeId,sceneId});
    const s=startInterviewSession(db,{requestId:`${prefix}.start`,mode:'TEXT',routeId,sceneId},T0);prepareInterviewDirectorSession(db,{requestId:`${prefix}.prepare`,sessionId:s.sessionId},T0);
    const opening=nextInterviewTurn(db,{requestId:`${prefix}.n1`,sessionId:s.sessionId},'2026-09-09T00:00:10.000Z');
    const advance=decideInterviewDirector(db,{requestId:`${prefix}.d1`,sessionId:s.sessionId,sourceTurnId:opening.turnId},'2026-09-09T00:00:10.000Z');
    assert.equal(advance.action,'ADVANCE_PHASE');
    const nextPhase:any=plan.phases.find((p:any)=>p.id===advance.nextPhaseId);
    const turn=nextInterviewTurn(db,{requestId:`${prefix}.n2`,sessionId:s.sessionId,targetSignalId:advance.targetSignalId??undefined},'2026-09-09T00:00:20.000Z');
    const decision=projectDirectorSemanticDecision(decideInterviewDirector(db,{requestId:`${prefix}.d2`,sessionId:s.sessionId,sourceTurnId:turn.turnId},'2026-09-09T00:00:20.000Z'));
    return {decision,askedSignal:turn.state.targetSignal,nextPhaseFocus:nextPhase?.focusSignalIds??[]};
  }finally{db.close();}
}

test('TP-DIR6-008 Tech1 / HM / FDE produce differentiated mission and phase-aligned replay targets',()=>{
  const tech=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'});const hm=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.hm'});const fde=buildDefaultDirectorPlan({routeId:'route.tob-fde',sceneId:'scene.fde-case'});
  assert.equal(new Set([tech.purpose,hm.purpose,fde.purpose]).size,3);assert.equal(new Set([tech.phases[1].id,hm.phases[1].id,fde.phases[1].id]).size,3);
  const replays=[firstFocusedDecision('route.ai-agent-devtools','scene.tech1','tech'),firstFocusedDecision('route.ai-agent-devtools','scene.hm','hm'),firstFocusedDecision('route.tob-fde','scene.fde-case','fde')];
  for(const replay of replays) assert.ok(replay.nextPhaseFocus.includes(replay.askedSignal),`phase handoff asked ${replay.askedSignal} outside ${replay.nextPhaseFocus.join(',')}`);
  assert.equal(new Set(replays.map(x=>x.decision.targetSignalId)).size,3);
});

test('TP-DIR6-009 opening/candidate-question transitions stay natural and candidate-visible prompts do not leak hidden metadata',async()=>{
  await withHost(async(base)=>{
    const openingSession:any=(await post(base,'/tool',{op:'interview.start_session',input:{requestId:'r9.open.start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}})).result;
    await post(base,'/tool',{op:'interview.director_prepare_session',input:{requestId:'r9.open.prepare',sessionId:openingSession.sessionId}});
    const opening:any=(await post(base,'/tool',{op:'interview.next_turn',input:{requestId:'r9.open.next',sessionId:openingSession.sessionId}})).result;
    assert.equal(opening.prompt.familyId,null); assert.equal(opening.state.targetSignal,null); assert.match(opening.prompt.primaryQuestion,/介绍|开始|经历/); assert.doesNotMatch(JSON.stringify(opening.prompt),/reasonCodes|verdict|hypothesis|claimDebt/i);

    const s:any=(await post(base,'/tool',{op:'interview.start_session',input:{requestId:'r9.start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}})).result;
    await post(base,'/tool',{op:'interview.director_prepare_session',input:{requestId:'r9.prepare',sessionId:s.sessionId,plan:planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.truthfulness')])}});
    const first:any=(await post(base,'/tool',{op:'interview.next_turn',input:{requestId:'r9.n1',sessionId:s.sessionId,targetSignalId:'signal.truthfulness'}})).result;
    const out:any=await post(base,'/interview/continue',{observeRequestId:'r9.obs',directorRequestId:'r9.dec',nextRequestId:'r9.n2',sessionId:s.sessionId,turnId:first.turnId,answerObservation:{signalUpdate:{signalId:'signal.truthfulness',state:'PROBING',confidence:.5}}});
    const prompt=JSON.stringify(out.result.next?.prompt??{});assert.doesNotMatch(prompt,/reasonCodes|verdict|hypothesis|claimDebt|正确答案|你应该回答/i);

    const terminal:any=(await post(base,'/tool',{op:'interview.start_session',input:{requestId:'r9.terminal.start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}})).result;
    const terminalPlan=planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.truthfulness')],[{id:'TECH',order:1,budgetSeconds:900,focusSignalIds:['signal.truthfulness'],mandatory:true},{id:'CANDIDATE_QUESTIONS',order:2,budgetSeconds:300,focusSignalIds:[],mandatory:true}]);
    await post(base,'/tool',{op:'interview.director_prepare_session',input:{requestId:'r9.terminal.prepare',sessionId:terminal.sessionId,plan:terminalPlan}});
    const tech:any=(await post(base,'/tool',{op:'interview.next_turn',input:{requestId:'r9.terminal.n1',sessionId:terminal.sessionId,targetSignalId:'signal.truthfulness'}})).result;
    const handoff:any=await post(base,'/interview/continue',{observeRequestId:'r9.terminal.obs',directorRequestId:'r9.terminal.dec',nextRequestId:'r9.terminal.n2',sessionId:terminal.sessionId,turnId:tech.turnId,answerObservation:{signalUpdate:{signalId:'signal.truthfulness',state:'CONFIRMED',confidence:.9}}});
    assert.equal(handoff.result.director.action,'ADVANCE_PHASE'); assert.equal(handoff.result.director.nextPhaseId,'CANDIDATE_QUESTIONS');
    assert.equal(handoff.result.next.prompt.familyId,null); assert.match(handoff.result.next.prompt.primaryQuestion,/想了解|问题|提问/); assert.doesNotMatch(JSON.stringify(handoff.result.next.prompt),/reasonCodes|verdict|hypothesis|claimDebt/i);
  });
});

function replayStrongClaim(prefix:string){const p=planFor('route.ai-agent-devtools','scene.tech1',[focus('signal.truthfulness')]);const {db,sessionId}=setup('route.ai-agent-devtools','scene.tech1',{...p,id:`mission.replay.fixed`});try{const t=nextInterviewTurn(db,{requestId:`${prefix}.n`,sessionId,targetSignalId:'signal.truthfulness'},'2026-09-09T00:06:00.000Z');observeInterviewAnswer(db,{requestId:`${prefix}.o`,sessionId,turnId:t.turnId,answerObservation:{detectedClaims:[{text:'我主导了关键边界设计',strength:'STRONG'}]}},'2026-09-09T00:06:20.000Z');return projectDirectorSemanticDecision(decideInterviewDirector(db,{requestId:`${prefix}.d`,sessionId,sourceTurnId:t.turnId},'2026-09-09T00:06:20.000Z'));}finally{db.close();}}

test('TP-DIR6-010 identical transcript and plan have stable semantic decision replay',()=>{assert.deepEqual(replayStrongClaim('a'),replayStrongClaim('b'));});

test('TP-DIR6-011 persona style override does not change focus or scoring authority',()=>{const a:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'});const b:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',override:{evidenceGrade:'USER_REAL',pressureBand:'HIGH',hintPolicy:'MINIMAL',interruptionPolicy:'ACTIVE',sourceRef:'realism.user'}} as any);assert.deepEqual(a.focusSignals,b.focusSignals);assert.deepEqual(a.phases.map((x:any)=>x.focusSignalIds),b.phases.map((x:any)=>x.focusSignalIds));assert.equal('scoreWeights' in b.archetype,false);});

test('TP-DIR6-012 realism summary fails closed when any frozen fixture fails',()=>{assert.equal(DIRECTOR_REALISM_FIXTURE_CATALOG_V1.length,12);assert.deepEqual(summarizeDirectorRealism([{id:'stop',pass:true},{id:'truth-risk',pass:false},{id:'phase',pass:true}]),{pass:false,total:3,passed:2,failed:['truth-risk']});});
