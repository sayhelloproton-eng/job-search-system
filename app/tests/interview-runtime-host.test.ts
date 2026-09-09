import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterviewRuntimeHost } from '../server/interview-runtime-host.ts';

async function startHost(){
  const dir=mkdtempSync(join(tmpdir(),'interview-host-'));
  const host=createInterviewRuntimeHost({dbPath:join(dir,'voice.db')});
  await new Promise<void>((resolve)=>host.server.listen(0,'127.0.0.1',resolve));
  const address:any=host.server.address();
  const base=`http://127.0.0.1:${address.port}`;
  return {dir,host,base};
}
async function call(base:string,request:any){
  const response=await fetch(`${base}/tool`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
  return {status:response.status,body:await response.json() as any};
}

test('TP-VOICE6-004 persistent localhost host carries a full Runtime turn sequence',async()=>{
  const {dir,host,base}=await startHost();
  try{
    const health:any=await (await fetch(`${base}/health`)).json();
    assert.equal(health.result.formalQuestions,42);
    const start=await call(base,{op:'interview.start_session',input:{requestId:'host.start.1',mode:'VOICE',routeId:'route.ai-agent-devtools',sceneId:'scene.hm'}});
    const sessionId=start.body.result.sessionId;
    const first=await call(base,{op:'interview.next_turn',input:{requestId:'host.next.1',sessionId}});
    assert.equal(first.body.result.prompt.familyId,'qf.devtools-value-adoption');
    const turnId=first.body.result.turnId;
    const observed=await call(base,{op:'interview.observe_answer',input:{requestId:'host.observe.1',sessionId,turnId,answerObservation:{summary:'先区分 usage、reliability 与可验证业务价值。'}}});
    assert.equal(observed.body.ok,true);
  } finally { await host.close(); rmSync(dir,{recursive:true,force:true}); }
});
test('TP-VOICE6-005 warm localhost host avoids per-turn process startup cost',async()=>{
  const {dir,host,base}=await startHost();
  try{
    const start=await call(base,{op:'interview.start_session',input:{requestId:'host.start.2',mode:'VOICE',routeId:'route.ai-agent-devtools',sceneId:'scene.hr'}});
    const sessionId=start.body.result.sessionId;
    await call(base,{op:'interview.next_turn',input:{requestId:'host.next.warm',sessionId}});
    const samples:number[]=[];
    for(let i=0;i<8;i++){
      const t0=performance.now();
      const response=await call(base,{op:'interview.next_turn',input:{requestId:`host.next.${i}`,sessionId,desiredAction:i%2?'FOLLOW_UP':'CHALLENGE'}});
      samples.push(performance.now()-t0);
      assert.equal(response.body.ok,true);
    }
    samples.sort((a,b)=>a-b);
    const p95=samples[Math.ceil(samples.length*.95)-1];
    assert.ok(p95<500,`warm localhost p95 ${p95.toFixed(2)}ms >= 500ms`);
  } finally { await host.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('TP-VOICE6-006 generic interview continue records the answer before returning the Runtime-owned next question',async()=>{
  const {dir,host,base}=await startHost();
  try{
    const start=await call(base,{op:'interview.start_session',input:{requestId:'host.start.6',mode:'VOICE',routeId:'route.ai-agent-devtools',sceneId:'scene.tech1'}});
    const sessionId=start.body.result.sessionId;
    const first=await call(base,{op:'interview.next_turn',input:{requestId:'host.next.6',sessionId}});
    const turnId=first.body.result.turnId;
    const response=await fetch(`${base}/interview/continue`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      observeRequestId:'host.observe.6',nextRequestId:'host.follow.6',sessionId,turnId,desiredAction:'CHALLENGE',
      answerObservation:{summary:'先稳定复现，再缩小故障区间并验证修改前后因果。'}
    })});
    const body:any=await response.json();
    assert.equal(body.ok,true);
    assert.equal(body.result.observed.turnId,turnId);
    assert.equal(body.result.next.turnIntent,'CHALLENGE');
    assert.notEqual(body.result.next.turnId,turnId);
    const stored:any=host.db.prepare('SELECT answer_summary FROM interview_turns WHERE id=?').get(turnId);
    assert.match(stored.answer_summary,/稳定复现/);
    assert.equal(Number((host.db.prepare('SELECT COUNT(*) c FROM interview_turns WHERE session_id=?').get(sessionId) as any).c),2);
  } finally { await host.close(); rmSync(dir,{recursive:true,force:true}); }
});