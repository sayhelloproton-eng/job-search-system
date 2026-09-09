import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { registerFormalQuestionCorpusWave4 } from '../server/interview-formal-corpus-wave4.ts';
import { startInterviewSession, nextInterviewTurn } from '../server/interview-voice-runtime.ts';
import { recordGrowthObservation, enqueueGrowthReview } from '../server/interview-growth.ts';
import { recordInterviewFeedback } from '../server/interview-feedback.ts';
import { planAdaptiveTraining, completeAdaptiveReview, INTERVIEW_ADAPTIVE_TOOL_CONTRACTS } from '../server/interview-adaptive-training.ts';
import { executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';

const now='2026-09-08T01:10:00.000Z';
function setup(){ const db=openDatabase(':memory:'); registerFormalQuestionCorpusWave4(db,now); return db; }

test('TP-P4-001 adaptive surface is bounded and cannot mutate Career Facts',()=>{
  assert.deepEqual(Object.keys(INTERVIEW_ADAPTIVE_TOOL_CONTRACTS).sort(),['interview.complete_review','interview.plan_training']);
  assert.ok(Object.values(INTERVIEW_ADAPTIVE_TOOL_CONTRACTS).every((x:any)=>x.careerFactsMutable===false));
  assert.equal(INTERVIEW_ADAPTIVE_TOOL_CONTRACTS['interview.plan_training'].sideEffect,'READ_ONLY');
  assert.equal(INTERVIEW_ADAPTIVE_TOOL_CONTRACTS['interview.complete_review'].idempotentBy,'request_id');
});

test('TP-P4-002 overdue review and regressing weakness outrank lower-priority open work with explicit reasons',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.s1',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    recordGrowthObservation(db,{requestId:'p4.g1',stableKey:'weak.debug.validation',itemType:'WEAKNESS',dimensionType:'QUESTION_FAMILY',dimensionRef:'qf.coding-debugging-strategy',title:'Debug 验证链条',summary:'因果验证薄弱',severity:'HIGH',sessionId:s.sessionId,observationType:'REGRESSION',evidenceText:'最近一次又退回只靠反复点击验证。'},'2026-09-01T01:00:00.000Z');
    enqueueGrowthReview(db,{requestId:'p4.r1',targetType:'QUESTION_FAMILY',targetId:'qf.coding-debugging-strategy',reason:'已到复习时间',priority:90,dueAt:'2026-09-07T01:00:00.000Z',sourceSessionId:s.sessionId},'2026-09-01T02:00:00.000Z');
    recordInterviewFeedback(db,{requestId:'p4.f1',sessionId:s.sessionId,eventType:'DEBRIEF',targetType:'QUESTION_FAMILY',targetId:'qf.build-vs-buy',observation:'表达需要再压缩',classification:'B'},'2026-09-08T00:00:00.000Z');
    const plan=planAdaptiveTraining(db,{routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',limit:3},now);
    assert.equal(plan.items[0].targetId,'qf.coding-debugging-strategy');
    assert.equal(plan.items[0].priorityBand,'P0');
    assert.ok(plan.items[0].reasons.includes('OVERDUE_REVIEW'));
    assert.ok(plan.items[0].reasons.includes('REGRESSING'));
  } finally { db.close(); }
});
test('TP-P4-003 JD focus can promote a relevant family without inventing an ability score',()=>{
  const db=setup(); try {
    db.prepare("INSERT INTO providers(id,code,name,enabled,created_at,updated_at) VALUES('p4.provider','p4','P4',1,?,?)").run(now,now);
    db.prepare(`INSERT INTO jobs(id,provider_id,identity_fingerprint,origin_kind,title,company,jd_text,current_verification_status,education_risk,is_viewed,first_seen_at,last_seen_at,created_at,updated_at)
      VALUES('p4.job','p4.provider','p4.fp','HISTORICAL_IMPORT','Agent Role','Co','agent developer tools','STALE','LOW',0,?,?,?,?)`).run(now,now,now,now);
    db.prepare("INSERT INTO interview_job_focus(id,job_id,route_id,question_family_id,weight,notes,created_at,updated_at) VALUES('p4.focus','p4.job','route.ai-agent-devtools','qf.devtools-value-adoption',90,'JD 强调 developer tools value',?,?)").run(now,now);
    const plan=planAdaptiveTraining(db,{routeId:'route.ai-agent-devtools',sceneId:'scene.hm',jobId:'p4.job',limit:3},now);
    assert.equal(plan.items[0].targetId,'qf.devtools-value-adoption');
    assert.ok(plan.items[0].reasons.some((x:string)=>x.startsWith('JD_FOCUS')));
    assert.equal('score' in plan.items[0],false);
    assert.equal('abilityScore' in plan,false);
  } finally { db.close(); }
});

test('TP-P4-004 open learning action becomes learn-then-retry rather than a fake interview mastery claim',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.learn.start',mode:'REAL',routeId:'route.advanced-fe-fullstack',sceneId:'scene.tech1'},now);
    recordInterviewFeedback(db,{requestId:'p4.learn.feedback',sessionId:s.sessionId,eventType:'REAL_INTERVIEW_OBSERVATION',targetType:'LEARNING',targetId:'topic.node.event-loop',observation:'Event Loop 细节卡住',classification:'D'},now);
    const plan=planAdaptiveTraining(db,{routeId:'route.advanced-fe-fullstack',sceneId:'scene.tech1',limit:3},now);
    const item=plan.items.find((x:any)=>x.targetId==='topic.node.event-loop');
    assert.ok(item); assert.equal(item.suggestedAction,'LEARN_THEN_RETRY'); assert.ok(item.reasons.includes('OPEN_TRAINING_ACTION_D'));
  } finally { db.close(); }
});
test('TP-P4-005 adaptive plan can drive the next formal question by preferred family',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.pref.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    enqueueGrowthReview(db,{requestId:'p4.pref.review',targetType:'QUESTION_FAMILY',targetId:'qf.context-access-strategy',reason:'需要专项复练 Context 获取策略',priority:95,dueAt:'2026-09-07T01:00:00.000Z',sourceSessionId:s.sessionId},'2026-09-01T02:00:00.000Z');
    const plan=planAdaptiveTraining(db,{routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',limit:1},now);
    assert.equal(plan.items[0].targetId,'qf.context-access-strategy');
    const turn=nextInterviewTurn(db,{requestId:'p4.pref.next',sessionId:s.sessionId,preferredFamilyId:plan.items[0].targetId},now);
    assert.equal(turn.prompt.familyId,'qf.context-access-strategy');
    assert.match(turn.prompt.primaryQuestion,/context|RAG|源码|Coding Agent/i);
  } finally { db.close(); }
});

test('TP-P4-006 preferred family fails closed when it is not eligible for the active route',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.route.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    assert.throws(()=>nextInterviewTurn(db,{requestId:'p4.route.next',sessionId:s.sessionId,preferredFamilyId:'qf.fde-requirement-decomposition'} as any,now),/INTERVIEW_PREFERRED_FAMILY_NOT_ELIGIBLE/);
  } finally { db.close(); }
});
test('TP-P4-007 completing a review is idempotent and schedules the next interval',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.review.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    const queued=enqueueGrowthReview(db,{requestId:'p4.review.enqueue',targetType:'QUESTION_FAMILY',targetId:'qf.context-access-strategy',reason:'Context 策略复习',priority:80,dueAt:'2026-09-08T01:00:00.000Z',sourceSessionId:s.sessionId},now);
    const input={requestId:'p4.review.complete',reviewId:queued.reviewId,outcome:'IMPROVED' as const,sessionId:s.sessionId};
    const a=completeAdaptiveReview(db,input,now); const b=completeAdaptiveReview(db,input,'2026-09-08T02:00:00.000Z');
    assert.deepEqual(b,a); assert.equal(a.nextIntervalDays,3);
    assert.equal((db.prepare('SELECT status FROM interview_review_queue WHERE id=?').get(queued.reviewId) as any).status,'DONE');
    const next:any=db.prepare("SELECT due_at,status FROM interview_review_queue WHERE id=?").get(a.nextReviewId);
    assert.equal(next.status,'OPEN'); assert.equal(next.due_at,'2026-09-11T01:10:00.000Z');
  } finally { db.close(); }
});

test('TP-P4-008 planning modes can isolate review or weakness work without fake score output',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.mode.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    enqueueGrowthReview(db,{requestId:'p4.mode.review',targetType:'QUESTION_FAMILY',targetId:'qf.context-access-strategy',reason:'到期复习',priority:70,dueAt:'2026-09-07T01:00:00.000Z',sourceSessionId:s.sessionId},now);
    recordGrowthObservation(db,{requestId:'p4.mode.growth',stableKey:'weak.debug',itemType:'WEAKNESS',dimensionType:'QUESTION_FAMILY',dimensionRef:'qf.coding-debugging-strategy',title:'Debug',summary:'验证薄弱',severity:'HIGH',sessionId:s.sessionId,observationType:'OCCURRENCE',evidenceText:'缺 targeted regression'},now);
    const review=planAdaptiveTraining(db,{routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',mode:'REVIEW' as any,limit:5},now);
    const weakness=planAdaptiveTraining(db,{routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',mode:'WEAKNESS' as any,limit:5},now);
    assert.ok(review.items.length>0&&review.items.every((x:any)=>x.sources.includes('REVIEW_QUEUE')));
    assert.ok(weakness.items.some((x:any)=>x.targetId==='qf.coding-debugging-strategy'));
    assert.equal('abilityScore' in review,false); assert.equal('score' in weakness.items[0],false);
  } finally { db.close(); }
});
test('TP-P4-009 AI Runtime closes one adaptive review cycle end to end',()=>{
  const db=openDatabase(':memory:'); try {
    const status=executeInterviewRuntimeCommand(db,{op:'status'});
    assert.deepEqual(status.adaptiveOperations.sort(),['interview.complete_review','interview.plan_training']);
    const s=executeInterviewRuntimeCommand(db,{op:'interview.start_session',input:{requestId:'p4.e2e.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}});
    const review=executeInterviewRuntimeCommand(db,{op:'interview.enqueue_review',input:{requestId:'p4.e2e.enqueue',targetType:'QUESTION_FAMILY',targetId:'qf.context-access-strategy',reason:'Adaptive E2E',priority:90,dueAt:'2026-09-07T01:00:00.000Z',sourceSessionId:s.sessionId}});
    const plan=executeInterviewRuntimeCommand(db,{op:'interview.plan_training',input:{routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',mode:'REVIEW',limit:1}});
    assert.equal(plan.items[0].targetId,'qf.context-access-strategy');
    const turn=executeInterviewRuntimeCommand(db,{op:'interview.next_turn',input:{requestId:'p4.e2e.next',sessionId:s.sessionId,preferredFamilyId:plan.items[0].targetId}});
    assert.equal(turn.prompt.familyId,'qf.context-access-strategy');
    executeInterviewRuntimeCommand(db,{op:'interview.observe_answer',input:{requestId:'p4.e2e.observe',sessionId:s.sessionId,turnId:turn.turnId,answerObservation:{summary:'先按访问成本分层，再按需下钻原始源码。'}}});
    const done=executeInterviewRuntimeCommand(db,{op:'interview.complete_review',input:{requestId:'p4.e2e.done',reviewId:review.reviewId,outcome:'IMPROVED',sessionId:s.sessionId}});
    assert.equal(done.nextIntervalDays,3);
    assert.equal((db.prepare('SELECT status FROM interview_review_queue WHERE id=?').get(review.reviewId) as any).status,'DONE');
    assert.equal((db.prepare('SELECT status FROM interview_review_queue WHERE id=?').get(done.nextReviewId) as any).status,'OPEN');
  } finally { db.close(); }
});
test('TP-P4-010 MIXED plan preserves review + weakness + JD diversity',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'p4.mix.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    enqueueGrowthReview(db,{requestId:'p4.mix.review',targetType:'QUESTION_FAMILY',targetId:'qf.context-access-strategy',reason:'到期复习',priority:80,dueAt:'2026-09-07T01:00:00.000Z',sourceSessionId:s.sessionId},now);
    recordGrowthObservation(db,{requestId:'p4.mix.growth',stableKey:'weak.mix.debug',itemType:'WEAKNESS',dimensionType:'QUESTION_FAMILY',dimensionRef:'qf.coding-debugging-strategy',title:'Debug',summary:'验证薄弱',severity:'HIGH',sessionId:s.sessionId,observationType:'OCCURRENCE',evidenceText:'缺 regression'},now);
    db.prepare("INSERT INTO providers(id,code,name,enabled,created_at,updated_at) VALUES('p4.mix.provider','mix','Mix',1,?,?)").run(now,now);
    db.prepare(`INSERT INTO jobs(id,provider_id,identity_fingerprint,origin_kind,title,company,jd_text,current_verification_status,education_risk,is_viewed,first_seen_at,last_seen_at,created_at,updated_at)
      VALUES('p4.mix.job','p4.mix.provider','p4.mix.fp','HISTORICAL_IMPORT','Agent Role','Co','developer tools value','STALE','LOW',0,?,?,?,?)`).run(now,now,now,now);
    db.prepare("INSERT INTO interview_job_focus(id,job_id,route_id,question_family_id,weight,notes,created_at,updated_at) VALUES('p4.mix.focus','p4.mix.job','route.ai-agent-devtools','qf.devtools-value-adoption',90,'JD value',?,?)").run(now,now);
    const plan=planAdaptiveTraining(db,{routeId:'route.ai-agent-devtools',sceneId:'scene.tech1',jobId:'p4.mix.job',mode:'MIXED',limit:3},now);
    assert.equal(plan.mode,'MIXED'); assert.equal(plan.items.length,3);
    assert.ok(plan.items.some((x:any)=>x.sources.includes('REVIEW_QUEUE')));
    assert.ok(plan.items.some((x:any)=>x.sources.includes('GROWTH_PROFILE')));
    assert.ok(plan.items.some((x:any)=>x.sources.includes('JD_FOCUS')));
  } finally { db.close(); }
});