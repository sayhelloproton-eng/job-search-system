import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { ensureInterviewRuntimeReady } from '../server/interview-runtime-cli.ts';
import { retrieveInterviewCandidates } from '../server/interview-retrieval.ts';

const CASES = [
  ['route.ai-agent-devtools','Agent Skill discovery progressive loading Tool MCP','qf.agent-skill-lifecycle'],
  ['route.ai-agent-devtools','multi agent manager handoff specialist orchestration','qf.agent-multi-agent-orchestration'],
  ['route.ai-agent-devtools','session working state long term memory retention retrieval','qf.agent-memory-strategy'],
  ['route.ai-agent-devtools','prompt version eval regression output contract','qf.prompt-engineering-eval'],
  ['route.ai-agent-devtools','agent max turns hard stop cancellation final output','qf.agent-runtime-recovery'],
  ['route.ai-agent-devtools','query rewrite ranking options rerank vector search','qf.agent-rag-retrieval'],
  ['route.advanced-fe-fullstack','React render commit memo re-render','qf.frontend-react-rendering'],
  ['route.advanced-fe-fullstack','LCP INP CLS field data lab data performance','qf.frontend-performance-measurement'],
  ['route.advanced-fe-fullstack','component testing user observable behavior internal state','qf.frontend-testing-strategy'],
  ['route.advanced-fe-fullstack','SSE EventSource WebSocket unidirectional bidirectional','qf.backend-http-api'],
  ['route.advanced-fe-fullstack','TypeScript discriminated union narrowing optional fields','qf.coding-typescript-modeling'],
  ['route.tob-fde','客户现场 页面很慢 偶发报错 日志不完整 前30分钟排查','qf.fde-case-response'],
] as const;

test('TP-RETRIEVAL-CURRENT-001 current 94-question corpus retrieves the expected family across all three routes',()=>{
  const db=openDatabase(':memory:');
  try{
    ensureInterviewRuntimeReady(db,'2026-09-10T02:00:00.000+08:00');
    const rows=CASES.map(([routeId,queryText,expectedFamily])=>{
      const result=retrieveInterviewCandidates(db,{routeId,queryText,limit:5});
      const top=result.candidates[0];
      return {routeId,queryText,expectedFamily,actualFamily:top?.familyId??null,actualQuestion:top?.questionId??null,reasons:top?.reasons??[]};
    });
    for(const row of rows){
      assert.equal(row.actualFamily,row.expectedFamily,JSON.stringify(row));
      assert.ok(row.reasons.length>0,JSON.stringify(row));
    }
    assert.equal(rows.filter(x=>x.routeId==='route.ai-agent-devtools').length,6);
    assert.equal(rows.filter(x=>x.routeId==='route.advanced-fe-fullstack').length,5);
    assert.equal(rows.filter(x=>x.routeId==='route.tob-fde').length,1);
  }finally{db.close();}
});
