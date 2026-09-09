import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { registerFormalQuestionCorpusWave4 } from '../server/interview-formal-corpus-wave4.ts';
import { startInterviewSession, nextInterviewTurn } from '../server/interview-voice-runtime.ts';
import { finishInterviewSession, recordInterviewFeedback, listInterviewTrainingActions, INTERVIEW_FEEDBACK_TOOL_CONTRACTS } from '../server/interview-feedback.ts';

function setup(){
  const db=openDatabase(':memory:');
  registerFormalQuestionCorpusWave4(db,'2026-09-07T15:00:00.000Z');
  return db;
}
const count=(db:any,sql:string,...args:any[])=>Number((db.prepare(sql).get(...args) as any).c);

test('TP-DB7-001 feedback surface is bounded and cannot mutate Career Facts',()=>{
  assert.deepEqual(Object.keys(INTERVIEW_FEEDBACK_TOOL_CONTRACTS).sort(),['interview.finish_session','interview.list_training_actions','interview.record_human_feedback']);
  assert.ok(Object.values(INTERVIEW_FEEDBACK_TOOL_CONTRACTS).every((x:any)=>x.careerFactsMutable===false));
});

test('TP-DB7-002 mock debrief creates one classified training action and is request-idempotent',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'db7.mock.start',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},'2026-09-07T15:01:00.000Z');
    const turn=nextInterviewTurn(db,{requestId:'db7.mock.next',sessionId:s.sessionId},'2026-09-07T15:01:01.000Z');
    const input={requestId:'db7.mock.feedback',sessionId:s.sessionId,turnId:turn.turnId,eventType:'DEBRIEF' as const,targetType:'QUESTION_FAMILY' as const,targetId:turn.prompt.familyId,observation:'会定位，但表达缺少因果验证与回归层次。',classification:'B' as const};
    const a=recordInterviewFeedback(db,input,'2026-09-07T15:02:00.000Z');
    const b=recordInterviewFeedback(db,input,'2026-09-07T15:03:00.000Z');
    assert.deepEqual(b,a);
    assert.equal(a.nextAction,'BLUEPRINT');
    assert.equal(count(db,'SELECT COUNT(*) c FROM interview_feedback_events WHERE session_id=?',s.sessionId),1);
    assert.equal(count(db,'SELECT COUNT(*) c FROM interview_training_events WHERE session_id=?',s.sessionId),1);
  } finally { db.close(); }
});

test('TP-DB7-003 real interview human feedback maps A-F without changing source assets',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'db7.real.start',mode:'REAL',routeId:'route.tob-fde',sceneId:'scene.hm'},'2026-09-07T15:10:00.000Z');
    const cases=[['A','REINFORCE'],['B','BLUEPRINT'],['C','ADD_EVIDENCE'],['D','LEARNING'],['E','TRADEOFF'],['F','RESUME']] as const;
    for(let i=0;i<cases.length;i++){
      const [classification,nextAction]=cases[i];
      const out=recordInterviewFeedback(db,{requestId:`db7.real.feedback.${i}`,sessionId:s.sessionId,eventType:'REAL_INTERVIEW_OBSERVATION',targetType:'SESSION',targetId:s.sessionId,observation:`人工复盘观察 ${classification}`,classification},`2026-09-07T15:1${i}:00.000Z`);
      assert.equal(out.nextAction,nextAction);
    }
    assert.equal(count(db,'SELECT COUNT(*) c FROM interview_feedback_events WHERE session_id=?',s.sessionId),6);
    assert.equal(count(db,'SELECT COUNT(*) c FROM interview_training_events WHERE session_id=?',s.sessionId),6);
    assert.equal(count(db,"SELECT COUNT(*) c FROM interview_training_events WHERE status='OPEN' AND session_id=?",s.sessionId),6);
  } finally { db.close(); }
});

test('TP-DB7-004 finish_session is idempotent and freezes the session for further turns',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'db7.finish.start',mode:'MOCK',routeId:'route.advanced-fe-fullstack',sceneId:'scene.deep-dive'},'2026-09-07T15:20:00.000Z');
    const input={requestId:'db7.finish.1',sessionId:s.sessionId,status:'FINISHED' as const};
    const a=finishInterviewSession(db,input,'2026-09-07T15:21:00.000Z');
    const b=finishInterviewSession(db,input,'2026-09-07T15:22:00.000Z');
    assert.deepEqual(b,a);
    assert.equal(a.status,'FINISHED');
    const row:any=db.prepare('SELECT status,finished_at FROM interview_sessions WHERE id=?').get(s.sessionId);
    assert.equal(row.status,'FINISHED');
    assert.equal(row.finished_at,'2026-09-07T15:21:00.000Z');
    assert.throws(()=>nextInterviewTurn(db,{requestId:'db7.after-finish',sessionId:s.sessionId}),/INTERVIEW_SESSION_NOT_ACTIVE/);
  } finally { db.close(); }
});

test('TP-DB7-005 AI can read OPEN training actions with owner workflow and provenance',()=>{
  const db=setup(); try {
    const s=startInterviewSession(db,{requestId:'db7.queue.start',mode:'TEXT',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'},'2026-09-07T15:30:00.000Z');
    recordInterviewFeedback(db,{requestId:'db7.queue.feedback',sessionId:s.sessionId,eventType:'DEBRIEF',targetType:'QUESTION_FAMILY',targetId:'qf.coding-debugging-strategy',observation:'调试主线存在，但因果验证和回归层次表达薄弱。',classification:'B'},'2026-09-07T15:31:00.000Z');
    const queue=listInterviewTrainingActions(db,{sessionId:s.sessionId});
    assert.equal(queue.count,1);
    assert.equal(queue.items[0].classification,'B');
    assert.equal(queue.items[0].nextAction,'BLUEPRINT');
    assert.equal(queue.items[0].ownerWorkflow,'INTERVIEW_BLUEPRINT');
    assert.equal(queue.items[0].source.routeId,'route.ai-agent-devtools');
    assert.match(queue.items[0].observation,/因果验证/);
  } finally { db.close(); }
});
