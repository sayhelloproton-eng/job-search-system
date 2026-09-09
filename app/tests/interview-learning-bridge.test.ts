import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { executeInterviewRuntimeCommand } from '../server/interview-runtime-cli.ts';
import { LEARNING_BRIDGE_TOOL_CONTRACTS } from '../server/interview-learning-bridge.ts';

function setup(){
  const db=openDatabase(':memory:');
  const start:any=executeInterviewRuntimeCommand(db,{op:'interview.start_session',input:{requestId:'start.bridge',mode:'MOCK',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}});
  return {db,sessionId:start.sessionId};
}
function addFeedback(db:any,sessionId:string,requestId:string,classification:'B'|'D',targetType='LEARNING',targetId='agent.memory'){
  return executeInterviewRuntimeCommand(db,{op:'interview.record_human_feedback',input:{requestId,sessionId,eventType:'DEBRIEF',targetType,targetId,observation:`gap:${targetId}`,classification}});
}

test('TP-LBRIDGE-001 runtime exposes bounded learning bridge contracts',()=>{
  const {db}=setup(); try{
    const status:any=executeInterviewRuntimeCommand(db,{op:'status'});
    assert.deepEqual(Object.keys(LEARNING_BRIDGE_TOOL_CONTRACTS),['learning.list_interview_handoffs','learning.record_interview_handoff_result']);
    assert.ok(status.learningBridgeOperations.includes('learning.list_interview_handoffs'));
    assert.equal(LEARNING_BRIDGE_TOOL_CONTRACTS['learning.record_interview_handoff_result'].careerFactsMutable,false);
  } finally { db.close(); }
});

test('TP-LBRIDGE-002 only OPEN LEARNING actions enter the learning inbox with interview provenance',()=>{
  const {db,sessionId}=setup(); try{
    addFeedback(db,sessionId,'fb.learn','D');
    addFeedback(db,sessionId,'fb.blueprint','B','QUESTION_FAMILY','qf.context-access-strategy');
    const inbox:any=executeInterviewRuntimeCommand(db,{op:'learning.list_interview_handoffs',input:{}});
    assert.equal(inbox.count,1);
    assert.equal(inbox.items[0].nextAction,'LEARNING');
    assert.equal(inbox.items[0].target.type,'TOPIC');
    assert.equal(inbox.items[0].target.id,'agent.memory');
    assert.equal(inbox.items[0].source.routeId,'route.ai-agent-devtools');
    assert.equal(inbox.items[0].source.sceneId,'scene.tech1');
  } finally { db.close(); }
});

test('TP-LBRIDGE-003 READY_FOR_REVIEW closes learning action and creates interview review without Career Fact mutation',()=>{
  const {db,sessionId}=setup(); try{
    const created:any=addFeedback(db,sessionId,'fb.ready','D','QUESTION_FAMILY','qf.agent-rag-retrieval');
    const before=Number((db.prepare('SELECT COUNT(*) c FROM interview_evidence_refs').get() as any).c);
    const result:any=executeInterviewRuntimeCommand(db,{op:'learning.record_interview_handoff_result',input:{requestId:'learn.ready',trainingEventId:created.trainingId,outcome:'READY_FOR_REVIEW',summary:'已完成机制学习与失败实验',artifactRefs:['docs/学习/实验/rag.md'],reviewTargetType:'QUESTION_FAMILY',reviewTargetId:'qf.agent-rag-retrieval'}});
    assert.equal(result.trainingStatus,'DONE');
    assert.ok(result.reviewId);
    const action:any=db.prepare('SELECT status FROM interview_training_events WHERE id=?').get(created.trainingId);
    assert.equal(action.status,'DONE');
    const review:any=db.prepare('SELECT target_type,target_id,status,source_session_id FROM interview_review_queue WHERE id=?').get(result.reviewId);
    assert.deepEqual([review.target_type,review.target_id,review.status,review.source_session_id],['QUESTION_FAMILY','qf.agent-rag-retrieval','OPEN',sessionId]);
    const after=Number((db.prepare('SELECT COUNT(*) c FROM interview_evidence_refs').get() as any).c);
    assert.equal(after,before);
    const retry:any=executeInterviewRuntimeCommand(db,{op:'learning.record_interview_handoff_result',input:{requestId:'learn.ready',trainingEventId:created.trainingId,outcome:'READY_FOR_REVIEW',summary:'已完成机制学习与失败实验',artifactRefs:['docs/学习/实验/rag.md'],reviewTargetType:'QUESTION_FAMILY',reviewTargetId:'qf.agent-rag-retrieval'}});
    assert.deepEqual(retry,result);
  } finally { db.close(); }
});

test('TP-LBRIDGE-004 PARTIAL and BLOCKED keep the learning action open and do not manufacture review readiness',()=>{
  for(const outcome of ['PARTIAL','BLOCKED'] as const){
    const {db,sessionId}=setup(); try{
      const created:any=addFeedback(db,sessionId,`fb.${outcome}`,'D');
      const result:any=executeInterviewRuntimeCommand(db,{op:'learning.record_interview_handoff_result',input:{requestId:`learn.${outcome}`,trainingEventId:created.trainingId,outcome,summary:`${outcome} learning result`}});
      assert.equal(result.trainingStatus,'OPEN');
      assert.equal(result.reviewId,null);
      assert.equal(Number((db.prepare('SELECT COUNT(*) c FROM interview_review_queue').get() as any).c),0);
    } finally { db.close(); }
  }
});
