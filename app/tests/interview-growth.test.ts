import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { registerFormalQuestionCorpusWave4 } from '../server/interview-formal-corpus-wave4.ts';
import { startInterviewSession, nextInterviewTurn, observeInterviewAnswer } from '../server/interview-voice-runtime.ts';
import { recordRoundDebrief, appendAnswerVersion, recordGrowthObservation, selectBestAnswer, enqueueGrowthReview, getGrowthProfile, INTERVIEW_GROWTH_TOOL_CONTRACTS } from '../server/interview-growth.ts';
import { executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';

const now='2026-09-08T00:40:00.000Z';
const tableNames=(db:any)=>new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r:any)=>r.name));

function seedSession(db:any){
  db.prepare("INSERT INTO interview_sessions(id,mode,route_id,scene_id,status,strategy_version,created_at,updated_at) VALUES('growth.s1','MOCK','route.ai-agent-devtools','scene.tech1','FINISHED','v1',?,?)").run(now,now);
}

test('TP-GROWTH-001 P3 migration creates the six durable growth assets',()=>{
  const db=openDatabase(':memory:'); try {
    const names=tableNames(db);
    for(const name of ['interview_round_debriefs','interview_answer_versions','interview_growth_items','interview_growth_observations','interview_best_answer_candidates','interview_review_queue']){
      assert.ok(names.has(name),`${name} missing`);
    }
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM schema_migrations WHERE version=4').get() as any).c),1);
  } finally { db.close(); }
});

test('TP-GROWTH-002 answer history is append-only and can preserve original to improved lineage',()=>{
  const db=openDatabase(':memory:'); try {
    seedSession(db);
    db.prepare("INSERT INTO interview_answer_versions(id,session_id,question_family_id,version_kind,content,created_at) VALUES('av1','growth.s1','qf.build-vs-buy','ORIGINAL','原回答',?)").run(now);
    db.prepare("INSERT INTO interview_answer_versions(id,session_id,question_family_id,parent_version_id,version_kind,content,created_at) VALUES('av2','growth.s1','qf.build-vs-buy','av1','IMPROVED','改进回答',?)").run(now);
    const rows=db.prepare("SELECT id,parent_version_id,version_kind,content FROM interview_answer_versions ORDER BY created_at,id").all() as any[];
    assert.equal(rows.length,2);
    assert.equal(rows[0].content,'原回答');
    assert.equal(rows[1].parent_version_id,'av1');
  } finally { db.close(); }
});
test('TP-GROWTH-003 growth tool surface is bounded and never mutates Career Facts',()=>{
  assert.deepEqual(Object.keys(INTERVIEW_GROWTH_TOOL_CONTRACTS).sort(),[
    'interview.append_answer_version','interview.enqueue_review','interview.get_growth_profile',
    'interview.record_growth_observation','interview.record_round_debrief','interview.select_best_answer'
  ]);
  assert.ok(Object.values(INTERVIEW_GROWTH_TOOL_CONTRACTS).every((x:any)=>x.careerFactsMutable===false));
});

test('TP-GROWTH-004 round debrief persists required reusable review material idempotently',()=>{
  const db=openDatabase(':memory:'); try {
    registerFormalQuestionCorpusWave4(db,now);
    const s=startInterviewSession(db,{requestId:'growth.debrief.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    const input={requestId:'growth.debrief.1',sessionId:s.sessionId,verdict:'PARTIAL' as const,scoreValue:62,scoreReason:'主线存在，但验证与回归层次不足。',strengths:['能从复现进入定位'],weaknesses:['缺因果证明'],interviewerIntents:['验证 Debugging 基线'],sentenceCritiques:[{text:'反复点没出现就算修好',issue:'不能证明因果'}],replacementExamples:['修改前稳定复现，修改后同路径不再复现，并补 targeted regression。'],knowledgeGaps:['回归测试层级'],expressionGaps:['验证标准不够具体'],nextTrainingPlan:['复练 debugging family']};
    const a=recordRoundDebrief(db,input,now); const b=recordRoundDebrief(db,input,'2026-09-08T00:41:00.000Z');
    assert.deepEqual(b,a);
    const row:any=db.prepare('SELECT verdict,score_reason,sentence_critiques_json,next_training_plan_json FROM interview_round_debriefs WHERE id=?').get(a.debriefId);
    assert.equal(row.verdict,'PARTIAL'); assert.match(row.score_reason,/回归层次/); assert.match(row.sentence_critiques_json,/不能证明因果/); assert.match(row.next_training_plan_json,/debugging/);
  } finally { db.close(); }
});
test('TP-GROWTH-005 answer versions, current best answer and history remain separately queryable',()=>{
  const db=openDatabase(':memory:'); try {
    registerFormalQuestionCorpusWave4(db,now);
    const s=startInterviewSession(db,{requestId:'growth.answer.start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    const turn=nextInterviewTurn(db,{requestId:'growth.answer.next',sessionId:s.sessionId},now);
    const original=appendAnswerVersion(db,{requestId:'growth.answer.v1',sessionId:s.sessionId,turnId:turn.turnId,questionFamilyId:turn.prompt.familyId,versionKind:'ORIGINAL',content:'先复现，再定位。'},now);
    const improved=appendAnswerVersion(db,{requestId:'growth.answer.v2',sessionId:s.sessionId,turnId:turn.turnId,questionFamilyId:turn.prompt.familyId,parentVersionId:original.answerVersionId,versionKind:'IMPROVED',content:'先稳定复现，再缩小故障区间，用修改前后对照证明因果，并补 targeted regression。'},'2026-09-08T00:42:00.000Z');
    selectBestAnswer(db,{requestId:'growth.answer.best',questionFamilyId:turn.prompt.familyId,routeId:'route.ai-agent-devtools',answerVersionId:improved.answerVersionId,selectionReason:'验证链条更完整。'},'2026-09-08T00:43:00.000Z');
    const profile=getGrowthProfile(db,{questionFamilyId:turn.prompt.familyId,routeId:'route.ai-agent-devtools'});
    assert.equal(profile.answerHistory.length,2);
    assert.equal(profile.currentBestAnswer.answerVersionId,improved.answerVersionId);
    assert.match(profile.currentBestAnswer.content,/targeted regression/);
    assert.throws(()=>db.prepare("UPDATE interview_answer_versions SET content='overwrite' WHERE id=?").run(original.answerVersionId),/INTERVIEW_ANSWER_VERSION_IMMUTABLE/);
  } finally { db.close(); }
});

test('TP-GROWTH-006 recurring weakness tracks occurrence, practice and trend instead of replacing history',()=>{
  const db=openDatabase(':memory:'); try {
    registerFormalQuestionCorpusWave4(db,now);
    const s=startInterviewSession(db,{requestId:'growth.weak.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    const base={stableKey:'weakness.debug.causal-validation',itemType:'WEAKNESS' as const,dimensionType:'QUESTION_FAMILY' as const,dimensionRef:'qf.coding-debugging-strategy',title:'Debug 因果验证薄弱',summary:'能定位问题，但修复有效性的因果证明不足。',severity:'MEDIUM' as const,sessionId:s.sessionId};
    recordGrowthObservation(db,{requestId:'growth.weak.1',...base,observationType:'OCCURRENCE',evidenceText:'第一次回答只说反复点击未复现。'},now);
    recordGrowthObservation(db,{requestId:'growth.weak.2',...base,observationType:'PRACTICE',evidenceText:'专项复练一次。'},'2026-09-08T00:44:00.000Z');
    recordGrowthObservation(db,{requestId:'growth.weak.3',...base,observationType:'IMPROVEMENT',evidenceText:'后续主动补充修改前后对照与回归测试。'},'2026-09-08T00:45:00.000Z');
    const profile=getGrowthProfile(db,{status:['OPEN','IMPROVING','STABLE','REGRESSING','RESOLVED']});
    const item=profile.growthItems.find((x:any)=>x.stableKey===base.stableKey);
    assert.equal(item.occurrenceCount,1); assert.equal(item.practiceCount,2); assert.equal(item.status,'IMPROVING');
    assert.equal(item.observations.length,3);
  } finally { db.close(); }
});
test('TP-GROWTH-007 review queue is AI-readable and keeps provenance to the originating session',()=>{
  const db=openDatabase(':memory:'); try {
    registerFormalQuestionCorpusWave4(db,now);
    const s=startInterviewSession(db,{requestId:'growth.review.start',mode:'REAL',routeId:'route.advanced-fe-fullstack',sceneId:'scene.deep-dive'},now);
    recordGrowthObservation(db,{requestId:'growth.review.gap',stableKey:'gap.node.event-loop',itemType:'KNOWLEDGE_GAP',dimensionType:'TOPIC',dimensionRef:'node.event-loop',title:'Node Event Loop 细节缺口',summary:'对 phase 与 microtask 边界掌握不稳定。',severity:'HIGH',sessionId:s.sessionId,observationType:'OCCURRENCE',evidenceText:'真实面试追问时卡住。'},now);
    const q=enqueueGrowthReview(db,{requestId:'growth.review.queue',targetType:'GROWTH_ITEM',targetId:'gap.node.event-loop',reason:'高优先级知识漏洞，需专项复习。',priority:90,dueAt:'2026-09-09T09:00:00.000Z',sourceSessionId:s.sessionId},now);
    const profile=getGrowthProfile(db,{reviewStatus:'OPEN'});
    assert.equal(profile.reviewQueue.length,1);
    assert.equal(profile.reviewQueue[0].reviewId,q.reviewId);
    assert.equal(profile.reviewQueue[0].sourceSessionId,s.sessionId);
    assert.equal(profile.reviewQueue[0].priority,90);
  } finally { db.close(); }
});

test('TP-GROWTH-008 AI Runtime can complete one full mock growth cycle and read it back',()=>{
  const db=openDatabase(':memory:'); try {
    const status=executeInterviewRuntimeCommand(db,{op:'status'});
    assert.equal(status.growthOperations.length,6);
    const s=executeInterviewRuntimeCommand(db,{op:'interview.start_session',input:{requestId:'growth.e2e.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}});
    const turn=executeInterviewRuntimeCommand(db,{op:'interview.next_turn',input:{requestId:'growth.e2e.next',sessionId:s.sessionId}});
    executeInterviewRuntimeCommand(db,{op:'interview.observe_answer',input:{requestId:'growth.e2e.observe',sessionId:s.sessionId,turnId:turn.turnId,answerObservation:{summary:'先复现、再定位，但验证标准表达较弱。'}}});
    const original=executeInterviewRuntimeCommand(db,{op:'interview.append_answer_version',input:{requestId:'growth.e2e.v1',sessionId:s.sessionId,turnId:turn.turnId,questionFamilyId:turn.prompt.familyId,versionKind:'ORIGINAL',content:'先复现，然后定位，反复测试没问题就算修好了。'}});
    const improved=executeInterviewRuntimeCommand(db,{op:'interview.append_answer_version',input:{requestId:'growth.e2e.v2',sessionId:s.sessionId,turnId:turn.turnId,questionFamilyId:turn.prompt.familyId,parentVersionId:original.answerVersionId,versionKind:'IMPROVED',content:'先稳定复现并保存基线，再缩小故障区间；修改后用同一路径做前后对照，并补 targeted regression 与发布后观察。'}});
    executeInterviewRuntimeCommand(db,{op:'interview.record_growth_observation',input:{requestId:'growth.e2e.gap',stableKey:'weakness.debug.validation',itemType:'WEAKNESS',dimensionType:'QUESTION_FAMILY',dimensionRef:turn.prompt.familyId,title:'Debug 验证链条薄弱',summary:'缺少因果证明、回归层次和发布后观察。',sessionId:s.sessionId,observationType:'OCCURRENCE',evidenceText:'本轮原回答将“多点几次没出现”视为修复证明。'}});
    executeInterviewRuntimeCommand(db,{op:'interview.record_round_debrief',input:{requestId:'growth.e2e.debrief',sessionId:s.sessionId,verdict:'PARTIAL',scoreReason:'Debug 主线存在，但验证链条不足。',strengths:['能从复现进入定位'],weaknesses:['因果验证'],interviewerIntents:['验证 debugging baseline 与验证意识'],sentenceCritiques:[{text:'反复测试没问题就算修好了',issue:'不能证明修改与问题消失存在因果'}],replacementExamples:['修改前基线→修改后同路径对照→targeted regression→发布后观察'],knowledgeGaps:['回归测试层级'],expressionGaps:['验证标准过于口语化'],nextTrainingPlan:['两天内复练同 Family']}});
    executeInterviewRuntimeCommand(db,{op:'interview.select_best_answer',input:{requestId:'growth.e2e.best',questionFamilyId:turn.prompt.familyId,routeId:'route.ai-agent-devtools',answerVersionId:improved.answerVersionId,selectionReason:'当前版本验证闭环更完整。'}});
    executeInterviewRuntimeCommand(db,{op:'interview.enqueue_review',input:{requestId:'growth.e2e.review',targetType:'QUESTION_FAMILY',targetId:turn.prompt.familyId,reason:'验证链条仍需复练。',priority:80,sourceSessionId:s.sessionId}});
    executeInterviewRuntimeCommand(db,{op:'interview.finish_session',input:{requestId:'growth.e2e.finish',sessionId:s.sessionId}});
    const profile=executeInterviewRuntimeCommand(db,{op:'interview.get_growth_profile',input:{questionFamilyId:turn.prompt.familyId,routeId:'route.ai-agent-devtools'}});
    assert.equal(profile.answerHistory.length,2); assert.equal(profile.growthItems.length,1); assert.equal(profile.reviewQueue.length,1); assert.equal(profile.currentBestAnswer.answerVersionId,improved.answerVersionId); assert.equal(profile.debriefs.length,1);
  } finally { db.close(); }
});

test('TP-GROWTH-009 incomplete round debrief is rejected instead of becoming a fake growth closeout',()=>{
  const db=openDatabase(':memory:'); try {
    registerFormalQuestionCorpusWave4(db,now);
    const s=startInterviewSession(db,{requestId:'growth.required.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},now);
    assert.throws(()=>recordRoundDebrief(db,{requestId:'growth.required.bad',sessionId:s.sessionId,verdict:'PARTIAL',scoreReason:'只有一句总结。',strengths:[],weaknesses:[]} as any,now),/INTERVIEW_DEBRIEF_/);
    assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM interview_round_debriefs').get() as any).c),0);
  } finally { db.close(); }
});

test('TP-GROWTH-010 REAL interview import becomes knowledge gap + action + review without changing Career Facts',()=>{
  const db=openDatabase(':memory:'); try {
    const s=executeInterviewRuntimeCommand(db,{op:'interview.start_session',input:{requestId:'growth.real.start',mode:'REAL',routeId:'route.advanced-fe-fullstack',sceneId:'scene.tech1'}});
    executeInterviewRuntimeCommand(db,{op:'interview.record_human_feedback',input:{requestId:'growth.real.feedback',sessionId:s.sessionId,eventType:'REAL_INTERVIEW_OBSERVATION',targetType:'LEARNING',targetId:'topic.node.event-loop',observation:'Node Event Loop phase 与 microtask 边界回答卡住。',classification:'D'}});
    executeInterviewRuntimeCommand(db,{op:'interview.record_growth_observation',input:{requestId:'growth.real.gap',stableKey:'gap.node.event-loop',itemType:'KNOWLEDGE_GAP',dimensionType:'TOPIC',dimensionRef:'node.event-loop',title:'Node Event Loop 细节缺口',summary:'phase / microtask 边界不稳定。',severity:'HIGH',sessionId:s.sessionId,observationType:'OCCURRENCE',evidenceText:'真实面试追问时卡住。'}});
    executeInterviewRuntimeCommand(db,{op:'interview.record_round_debrief',input:{requestId:'growth.real.debrief',sessionId:s.sessionId,verdict:'PARTIAL',scoreReason:'真实面试暴露 Node Event Loop 细节缺口。',strengths:['能承认边界，没有硬编'],weaknesses:['Node runtime 细节不稳定'],interviewerIntents:['验证 Node 基础下限'],sentenceCritiques:[],replacementExamples:['先说明已知执行顺序，再明确不确定的 phase 细节并给验证方法。'],knowledgeGaps:['Node Event Loop phase / microtask'],expressionGaps:[],nextTrainingPlan:['完成 Node Event Loop 专项并复练']}});
    executeInterviewRuntimeCommand(db,{op:'interview.enqueue_review',input:{requestId:'growth.real.review',targetType:'TOPIC',targetId:'node.event-loop',reason:'真实面试高优先级知识缺口。',priority:95,sourceSessionId:s.sessionId}});
    executeInterviewRuntimeCommand(db,{op:'interview.finish_session',input:{requestId:'growth.real.finish',sessionId:s.sessionId}});
    const actions=executeInterviewRuntimeCommand(db,{op:'interview.list_training_actions',input:{sessionId:s.sessionId}});
    const profile=executeInterviewRuntimeCommand(db,{op:'interview.get_growth_profile',input:{status:['OPEN','IMPROVING','STABLE','REGRESSING','RESOLVED']}});
    assert.equal(actions.items[0].nextAction,'LEARNING'); assert.equal(profile.growthItems[0].itemType,'KNOWLEDGE_GAP'); assert.equal(profile.reviewQueue[0].priority,95);
  } finally { db.close(); }
});