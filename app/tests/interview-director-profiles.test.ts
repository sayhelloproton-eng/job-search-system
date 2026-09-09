import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';
import {
  INTERVIEWER_ARCHETYPES, SCENE_DIRECTOR_MANDATES, ROUTE_INTERVIEW_LOOPS,
  buildDefaultDirectorPlan, getRouteInterviewLoop
} from '../server/interview-director-profiles.ts';

function start(db:any,id:string,routeId:string,sceneId:string){
  return executeInterviewRuntimeCommand(db,{op:'interview.start_session',input:{requestId:id,mode:'TEXT',routeId,sceneId}}) as any;
}

test('TP-DIR5-001 exactly five archetypes exist and contain no scoring weights',()=>{
  assert.equal(Object.keys(INTERVIEWER_ARCHETYPES).length,5);
  for(const value of Object.values(INTERVIEWER_ARCHETYPES) as any[]){
    assert.ok(value.mandate); assert.ok(value.pressureBand); assert.ok(value.hintPolicy); assert.ok(value.interruptionPolicy);
    assert.equal('scoreWeights' in value,false); assert.equal('signalWeights' in value,false);
  }
});

test('TP-DIR5-002 all ten existing scenes have executable mandates',()=>{
  const expected=['scene.hr','scene.tech1','scene.deep-dive','scene.system-design','scene.coding','scene.fde-case','scene.hm','scene.cross','scene.final','scene.offer'];
  assert.deepEqual(Object.keys(SCENE_DIRECTOR_MANDATES).sort(),expected.sort());
  for(const scene of expected){const m:any=(SCENE_DIRECTOR_MANDATES as any)[scene];assert.ok(m.archetypeId);assert.ok(m.focusSignals.length>=1);assert.ok(m.mandate);}
});

test('TP-DIR5-003 three target routes have ordered default interview loops',()=>{
  assert.equal(Object.keys(ROUTE_INTERVIEW_LOOPS).length,3);
  assert.deepEqual(getRouteInterviewLoop('route.ai-agent-devtools').rounds.map((x:any)=>x.sceneId),['scene.hr','scene.tech1','scene.deep-dive','scene.hm','scene.final']);
  assert.ok(getRouteInterviewLoop('route.advanced-fe-fullstack').rounds.some((x:any)=>x.sceneId==='scene.deep-dive'));
  assert.ok(getRouteInterviewLoop('route.tob-fde').rounds.some((x:any)=>x.sceneId==='scene.fde-case'));
});

test('TP-DIR5-004 route/scene composition produces differentiated realistic plans',()=>{
  const ai:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'});
  const fe:any=buildDefaultDirectorPlan({routeId:'route.advanced-fe-fullstack',sceneId:'scene.deep-dive'});
  const fde:any=buildDefaultDirectorPlan({routeId:'route.tob-fde',sceneId:'scene.fde-case'});
  assert.notDeepEqual(ai.phases.map((x:any)=>x.id),fe.phases.map((x:any)=>x.id));
  assert.ok(ai.phases.some((x:any)=>x.id==='AGENT_TECHNICAL'));
  assert.ok(fe.phases.some((x:any)=>x.id==='FRONTEND_ARCH_PERF'));
  assert.ok(fde.phases.some((x:any)=>x.id==='DELIVERY_RISK'));
});

test('TP-DIR5-005 director_prepare_session can build a default plan from Session route/scene',()=>{
  const db=openDatabase(':memory:');try{const s=start(db,'d5.start','route.ai-agent-devtools','scene.tech1');
    const prepared:any=executeInterviewRuntimeCommand(db,{op:'interview.director_prepare_session',input:{requestId:'d5.prepare',sessionId:s.sessionId}});
    assert.equal(prepared.planSource,'DEFAULT_ROUTE_SCENE'); assert.equal(prepared.currentPhaseId,'OPENING');
    const stored:any=db.prepare('SELECT plan_json FROM interview_director_session_plans WHERE session_id=?').get(s.sessionId);
    assert.match(stored.plan_json,/AGENT_TECHNICAL/);
  }finally{db.close();}
});

test('TP-DIR5-006 explicit plan remains authoritative and backward compatible',()=>{
  const db=openDatabase(':memory:');try{const s=start(db,'d6.start','route.ai-agent-devtools','scene.tech1');
    const explicit:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}); explicit.id='mission.explicit';
    const prepared:any=executeInterviewRuntimeCommand(db,{op:'interview.director_prepare_session',input:{requestId:'d6.prepare',sessionId:s.sessionId,plan:explicit}});
    assert.equal(prepared.missionId,'mission.explicit'); assert.equal(prepared.planSource,'EXPLICIT');
  }finally{db.close();}
});

test('TP-DIR5-007 only sufficiently grounded overrides can change safe runtime parameters',()=>{
  assert.throws(()=>buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',override:{evidenceGrade:'SINGLE_REPORT',roundBudgetSeconds:2700}} as any),/DIRECTOR_OVERRIDE_EVIDENCE_INSUFFICIENT/);
  const plan:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',override:{evidenceGrade:'MULTI_REPORT',roundBudgetSeconds:2700,pressureBand:'HIGH',sourceRef:'dirsrc.test'}} as any);
  assert.equal(plan.roundBudgetSeconds,2700); assert.equal(plan.archetype.pressureBand,'HIGH'); assert.equal(plan.overrideEvidence.grade,'MULTI_REPORT');
});

test('TP-DIR5-008 override cannot replace route, scene, focus signals or scoring authority',()=>{
  for(const forbidden of [{focusSignals:[]},{routeId:'route.tob-fde'},{sceneId:'scene.hm'},{scoreWeights:{x:1}}])
    assert.throws(()=>buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',override:{evidenceGrade:'OFFICIAL',...forbidden}} as any),/DIRECTOR_OVERRIDE_FORBIDDEN_AUTHORITY/);
});

test('TP-DIR5-009 persona changes style only, not mission focus signal set',()=>{
  const a:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'});
  const b:any=buildDefaultDirectorPlan({routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',override:{evidenceGrade:'USER_REAL',pressureBand:'HIGH',hintPolicy:'MINIMAL',sourceRef:'real.1'}} as any);
  assert.deepEqual(a.focusSignals,b.focusSignals); assert.notEqual(a.archetype.pressureBand,b.archetype.pressureBand);
});

test('TP-DIR5-010 Runtime status exposes the three default loops without changing Director tool surface',()=>{
  const db=openDatabase(':memory:');try{const status:any=executeInterviewRuntimeCommand(db,{op:'status'});assert.equal(status.directorProfileSummary.archetypes,5);assert.equal(status.directorProfileSummary.sceneMandates,10);assert.equal(Object.keys(status.directorProfileSummary.routeLoops).length,3);assert.equal(status.directorOperations.length,4);}finally{db.close();}
});
