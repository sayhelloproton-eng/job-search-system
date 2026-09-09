import { registerFormalQuestionCorpusSocialGapV1 } from './interview-formal-corpus-social-gap-v1.ts';
import { registerAuditedInterviewSources, compileInterviewDocument } from './interview-source-compiler.ts';

type QuestionSeed={id:string;familyId:string;methodKey:string;text:string;difficulty:'SENIOR'|'STAFF';tags:string;pressure:string};
type MethodSeed={key:string;sourceId:string;locator:string;text:string};

const QUESTIONS:QuestionSeed[]=[
  {id:'fq8.agent-runtime-loop.01',familyId:'qf.agent-runtime-recovery',methodKey:'loop',difficulty:'STAFF',tags:'agent loop max turns max_turns final output cancellation hard stop tool handoff runtime',text:'Agent 在 Tool / Handoff 循环里迟迟没有 final output 时，你会怎样设计 max turns、取消和业务停止条件，避免无限执行？',pressure:'如果 SDK 已经提供 max_turns，为什么它仍只是 hard safety limit，而不能替代“任务已经正确结束”的业务判定？'},
  {id:'fq8.rag-query-rank.01',familyId:'qf.agent-rag-retrieval',methodKey:'rag-rank',difficulty:'STAFF',tags:'rag query rewrite rewrite_query ranking options rerank vector search score eval intent',text:'RAG 召回不稳定时，你什么时候会启用 query rewrite 或调整 ranking options，而不是先改语料、chunk 或 embedding？你怎样验证改写没有扭曲用户意图？',pressure:'如果 top-k relevance 指标变好，但最终回答质量反而下降，你会怎样判断这次 rewrite / ranking 调整是否应该回滚？'},
  {id:'fq8.rag-graphrag.01',familyId:'qf.agent-rag-retrieval',methodKey:'graphrag',difficulty:'STAFF',tags:'graphrag graph rag local global drift basic search entity relation community indexing cost vector rag',text:'什么时候值得从普通 top-k Vector RAG 升级到 GraphRAG？你会怎样根据实体关系、全局主题问题和索引成本选择 Local、Global、DRIFT 或 Basic Search？',pressure:'如果用户只是查一个明确事实，为什么 GraphRAG 可能是过度设计，Basic Search 反而更合适？'},
  {id:'fq8.backend-streaming.01',familyId:'qf.backend-http-api',methodKey:'streaming',difficulty:'SENIOR',tags:'sse eventsource websocket ai streaming unidirectional bidirectional server client stream http',text:'AI 对话的流式输出为什么 SSE 往往已经够用，什么时候你会改用 WebSocket？请从数据方向和交互需求解释，而不是只比较 API 写法。',pressure:'如果场景只是 server→client 的 token stream，双向连接带来的额外复杂度是否真的有价值？'},
];

const METHODS:MethodSeed[]=[
  {key:'loop',sourceId:'source.openai-agents-running',locator:'social-enhancement-v1/agent-loop',text:'OpenAI Agents SDK Runner 会在 final output、handoff 与 tool call 之间循环；超过 max_turns 会抛出 MaxTurnsExceeded，且运行支持取消。max_turns 是运行时 hard stop，不等价于业务已经正确完成。'},
  {key:'rag-rank',sourceId:'source.openai-retrieval',locator:'social-enhancement-v1/query-rank',text:'OpenAI Vector Store Search 支持 rewrite_query、ranking_options、结果数量、filters，并返回每个 chunk 的 score；query rewrite 和 ranking 调整应作为可评测检索策略，而不是把高相似度直接当最终答案质量。'},
  {key:'graphrag',sourceId:'source.microsoft-graphrag',locator:'social-enhancement-v1/graphrag',text:'Microsoft GraphRAG 通过实体、关系、社区与社区摘要建立结构化索引；Query Engine 提供 Local、Global、DRIFT 与 Basic Search，不同模式适合实体局部、全局主题或 baseline vector RAG，并具有不同索引/查询成本。'},
  {key:'streaming',sourceId:'source.mdn-eventsource',locator:'social-enhancement-v1/sse-websocket',text:'MDN EventSource 表明 SSE 通过持久 HTTP 连接接收 text/event-stream，并且与 WebSocket 不同，SSE 数据方向是 server→client 单向；是否需要双向交互应成为 SSE 与 WebSocket 的核心选型边界。'},
];

function registerMethodUnits(db:any,now:string){
  registerAuditedInterviewSources(db,now);
  const units=new Map<string,string>();
  for(const method of METHODS){
    const source:any=db.prepare('SELECT canonical_url,name FROM interview_sources WHERE id=?').get(method.sourceId);
    if(!source) throw new Error(`SE1_SOURCE_MISSING:${method.sourceId}`);
    const compiled:any=compileInterviewDocument(db,{sourceId:method.sourceId,title:`Social Enhancement V1｜${source.name}`,canonicalUrl:source.canonical_url,capturedAt:now,units:[{locator:method.locator,kind:'TECHNIQUE',text:method.text}]});
    const unit=compiled.units[0]; if(!unit?.unitId) throw new Error(`SE1_SOURCE_UNIT_MISSING:${method.key}`);
    units.set(method.key,unit.unitId);
  }
  return units;
}

export function registerFormalQuestionCorpusSocialEnhancementV1(db:any,now=new Date().toISOString()){
  registerFormalQuestionCorpusSocialGapV1(db,now);
  const methodUnits=registerMethodUnits(db,now);
  db.exec('BEGIN;');
  try{
    const question=db.prepare(`INSERT INTO interview_questions(id,question_family_id,source_unit_id,canonical_text,language,difficulty,lifecycle,created_at,updated_at)
      VALUES(?,?,?,?,'zh-CN',?,'ACTIVE',?,?)
      ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,source_unit_id=excluded.source_unit_id,canonical_text=excluded.canonical_text,difficulty=excluded.difficulty,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const variant=db.prepare(`INSERT INTO interview_question_variants(id,question_id,source_unit_id,text,tone,pressure_mode,language,lifecycle,created_at,updated_at)
      VALUES(?,?,?,?,'DIRECT','PRESSURE','zh-CN','ACTIVE',?,?)
      ON CONFLICT(id) DO UPDATE SET source_unit_id=excluded.source_unit_id,text=excluded.text,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const search=db.prepare(`INSERT INTO interview_question_search(item_type,item_id,family_id,text,tags,signal_terms) VALUES('QUESTION',?,?,?,?,?)`);
    for(const row of QUESTIONS){
      const unitId=methodUnits.get(row.methodKey); if(!unitId) throw new Error(`SE1_METHOD_NOT_FOUND:${row.methodKey}`);
      question.run(row.id,row.familyId,unitId,row.text,row.difficulty,now,now);
      variant.run(`fq8v.${row.id.slice(4)}`,row.id,unitId,row.pressure,now,now);
      const signal:any=db.prepare(`SELECT s.id,s.name FROM interview_question_families f LEFT JOIN interview_signals s ON s.id=f.primary_signal_id WHERE f.id=?`).get(row.familyId);
      db.prepare("DELETE FROM interview_question_search WHERE item_type='QUESTION' AND item_id=?").run(row.id);
      search.run(row.id,row.familyId,`${row.text} ${row.pressure}`,row.tags,`${signal?.id??''} ${signal?.name??''}`);
    }
    db.exec('COMMIT;');
    return {families:0,questions:QUESTIONS.length,variants:QUESTIONS.length,anchors:0,methodUnits:methodUnits.size};
  }catch(error){try{db.exec('ROLLBACK;')}catch{} throw error;}
}
