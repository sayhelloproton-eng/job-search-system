import { registerFormalQuestionCorpusWave4 } from './interview-formal-corpus-wave4.ts';
import { registerAuditedInterviewSources, compileInterviewDocument } from './interview-source-compiler.ts';

type FamilySeed={id:string;name:string;signalId:string;intent:string;decisionPattern:string;topicId:string;sourceId:string;methodKey:string};
type QuestionSeed={id:string;familyId:string;methodKey:string;text:string;difficulty:'SENIOR'|'STAFF';tags:string;pressure:string};
type MethodSeed={key:string;sourceId:string;locator:string;text:string};
type AnchorSeed={id:string;familyId:string;signalId:string;methodKey:string;polarity:'POSITIVE'|'NEGATIVE';behavior:string};

const FAMILIES:FamilySeed[]=[
  {id:'qf.agent-mcp-tools',name:'MCP Tool Contract & Control',signalId:'signal.judgment',topicId:'agent.mcp',sourceId:'source.mcp-official',methodKey:'m5.mcp',intent:'验证 MCP Tool 设计、发现调用、安全与人类控制边界',decisionPattern:'Capability → Tool Schema → Discovery/Call → Permission → Result/Error'},
  {id:'qf.agent-tool-calling-contract',name:'Tool Calling Contract',signalId:'signal.judgment',topicId:'agent.tool-calling',sourceId:'source.openai-function-calling',methodKey:'m5.tools',intent:'验证模型参数结构与真实执行安全之间的边界',decisionPattern:'Intent → Schema → Validate → Authorize → Execute → Verify'},
  {id:'qf.agent-workflow-boundary',name:'Agent vs Workflow Boundary',signalId:'signal.judgment',topicId:'agent.workflow',sourceId:'source.openai-function-calling',methodKey:'m5.workflow',intent:'验证何时使用模型自主决策，何时回收为确定性工作流',decisionPattern:'Uncertainty → Authority → Deterministic Step → Checkpoint → Recovery'},
  {id:'qf.agent-rag-retrieval',name:'RAG Retrieval Quality',signalId:'signal.ceiling',topicId:'agent.rag',sourceId:'source.openai-retrieval',methodKey:'m5.rag',intent:'验证检索结果、相关性与最终 grounded answer 之间的质量链',decisionPattern:'Corpus → Chunk → Query → Retrieve/Rank → Ground/Cite → Eval'},
  {id:'qf.backend-node-runtime',name:'Node Runtime & Event Loop',signalId:'signal.baseline',topicId:'backend.node-runtime',sourceId:'source.nodejs-docs',methodKey:'m5.node',intent:'验证 Node Event Loop、Timer、阻塞与服务端运行时基础',decisionPattern:'Workload → Event Loop → Blocking/Async → Measurement → Mitigation'},
  {id:'qf.backend-http-api',name:'HTTP / API Semantics',signalId:'signal.baseline',topicId:'backend.http-api',sourceId:'source.mdn-http',methodKey:'m5.http',intent:'验证 HTTP method、幂等、状态与 API 重试语义',decisionPattern:'Operation Semantics → Method → Idempotency → Error → Retry Contract'},
  {id:'qf.backend-database-isolation',name:'Database Transaction Isolation',signalId:'signal.baseline',topicId:'backend.database',sourceId:'source.postgresql-docs',methodKey:'m5.db',intent:'验证事务隔离、并发异常与一致性成本判断',decisionPattern:'Invariant → Transaction → Isolation → Anomaly → Retry/Lock'},
  {id:'qf.backend-reliability-idempotency',name:'Backend Reliability & Idempotency',signalId:'signal.judgment',topicId:'backend.reliability',sourceId:'source.mdn-http',methodKey:'m5.reliability',intent:'验证超时重试、重复执行、未知结果与副作用控制',decisionPattern:'Failure → Unknown Outcome → Idempotency → Retry Budget → Observe/Recover'},
  {id:'qf.frontend-react-rendering',name:'React Render / Commit',signalId:'signal.baseline',topicId:'frontend.react',sourceId:'source.react-docs',methodKey:'m5.react',intent:'验证 React render/commit、state/props/context 与 memo 性能边界',decisionPattern:'State Change → Render → Commit → Measure → Optimize'},
  {id:'qf.frontend-performance-measurement',name:'Frontend Performance Measurement',signalId:'signal.judgment',topicId:'frontend.performance',sourceId:'source.webdev-vitals',methodKey:'m5.perf',intent:'验证性能指标、现场数据、实验与优化因果链',decisionPattern:'User Symptom → Field Metric → Trace → Change → Re-measure'},
  {id:'qf.frontend-testing-strategy',name:'Frontend Testing Strategy',signalId:'signal.judgment',topicId:'frontend.testing',sourceId:'source.testing-library',methodKey:'m5.testing',intent:'验证用户行为导向的测试层级、查询与回归设计',decisionPattern:'Risk → User Behavior → Test Level → Assertion → Regression'},
];

const QUESTIONS:QuestionSeed[]=[
  {id:'fq5.agent-mcp.01',familyId:'qf.agent-mcp-tools',methodKey:'m5.mcp',difficulty:'SENIOR',tags:'mcp tools input schema tool granularity error semantics',text:'如果你设计一个 MCP Server 给 Coding Agent 用，会怎样划分 Tool 粒度、input schema 和错误语义？',pressure:'为什么把几十个底层操作全部暴露成 Tool，可能反而降低模型选择和执行的可靠性？'},
  {id:'fq5.agent-mcp.02',familyId:'qf.agent-mcp-tools',methodKey:'m5.mcp',difficulty:'SENIOR',tags:'mcp tools human in loop permission write action safety',text:'MCP Tool 可以被模型发现和调用，但涉及写操作时你会怎样设计权限、人类确认和结果边界？',pressure:'如果模型生成的参数完全符合 schema，为什么仍不能直接执行高风险写操作？'},
  {id:'fq5.agent-tools.01',familyId:'qf.agent-tool-calling-contract',methodKey:'m5.tools',difficulty:'SENIOR',tags:'function calling structured outputs strict schema validation tool execution',text:'Function Calling 已经用 strict schema 保证参数结构正确，应用层为什么仍然必须做校验和权限控制？',pressure:'结构合法和业务安全分别由谁负责？如果工具有副作用，边界还要增加什么？'},
  {id:'fq5.agent-tools.02',familyId:'qf.agent-tool-calling-contract',methodKey:'m5.tools',difficulty:'SENIOR',tags:'tool calling idempotency authorization result validation side effect',text:'模型调用一个会写数据库的 Tool，你如何设计 request identity、授权、执行结果校验和重试？',pressure:'如果模型因为超时再次发出同一个调用，你怎样避免重复副作用？'},
  {id:'fq5.agent-workflow.01',familyId:'qf.agent-workflow-boundary',methodKey:'m5.workflow',difficulty:'STAFF',tags:'agent workflow deterministic state machine orchestration authority',text:'什么时候应该让 Agent 自主决定下一步，什么时候应该把流程收敛成确定性 Workflow 或状态机？',pressure:'如果模型更灵活，为什么不把全部编排都交给模型？'},
  {id:'fq5.agent-workflow.02',familyId:'qf.agent-workflow-boundary',methodKey:'m5.workflow',difficulty:'STAFF',tags:'workflow checkpoint retry recovery idempotency long running',text:'一个多步 AI Workflow 在第三步失败，你会怎样设计 checkpoint、retry 和恢复，避免从头重复副作用？',pressure:'哪些状态属于模型上下文，哪些必须由程序持久化并拥有 authority？'},
  {id:'fq5.agent-rag.01',familyId:'qf.agent-rag-retrieval',methodKey:'m5.rag',difficulty:'SENIOR',tags:'rag retrieval vector search score chunk grounding citation eval',text:'向量检索返回了高相似度 chunk，为什么这仍然不能证明最终回答可靠？',pressure:'你会怎样分别验证 retrieval relevance、grounding、citation 和最终任务效果？'},
  {id:'fq5.agent-rag.02',familyId:'qf.agent-rag-retrieval',methodKey:'m5.rag',difficulty:'STAFF',tags:'rag ingestion chunking query rewrite retrieval ranking generation failure classification',text:'RAG 效果突然变差时，你如何区分 ingestion、chunking、query、retrieval/ranking 和 generation 的问题？',pressure:'如果最终答案错了，但 top-k 里其实有正确 chunk，你会把根因归在哪一层？'},
  {id:'fq5.backend-node.01',familyId:'qf.backend-node-runtime',methodKey:'m5.node',difficulty:'SENIOR',tags:'node event loop timers blocking cpu async server runtime',text:'Node 服务没有高 CPU 总量，但请求延迟偶发飙升，你会怎样从 Event Loop 和阻塞任务角度排查？',pressure:'把同步逻辑改成 Promise 为什么不一定能解决真正的阻塞？'},
  {id:'fq5.backend-node.02',familyId:'qf.backend-node-runtime',methodKey:'m5.node',difficulty:'SENIOR',tags:'node timers setImmediate event loop lifecycle process latency',text:'你怎样解释 Node 中 Timer、异步回调和 Event Loop 生命周期之间的关系，并把它用于服务端问题定位？',pressure:'为什么“setTimeout 设为 0”不代表回调会立刻执行？'},
  {id:'fq5.backend-http.01',familyId:'qf.backend-http-api',methodKey:'m5.http',difficulty:'SENIOR',tags:'http api safe idempotent post put patch retry methods',text:'设计写 API 时，你怎么区分 HTTP method 的 safe、idempotent 和“业务上允许重试”这几个概念？',pressure:'POST 默认不是幂等的，如果客户端超时后必须重试，你会怎么设计？'},
  {id:'fq5.backend-http.02',familyId:'qf.backend-http-api',methodKey:'m5.http',difficulty:'SENIOR',tags:'http api status code error contract timeout retry idempotency key',text:'API 已经返回了规范 status code，为什么还不够形成稳定的错误与重试契约？',pressure:'哪些错误适合客户端重试，哪些必须立即停止或转人工处理？'},
  {id:'fq5.backend-db.01',familyId:'qf.backend-database-isolation',methodKey:'m5.db',difficulty:'SENIOR',tags:'database transaction isolation read committed repeatable read serializable anomaly',text:'Read Committed、Repeatable Read、Serializable 的差别，你会怎样从业务不变量和并发异常来解释，而不是背定义？',pressure:'为什么更高隔离级别不是免费的“越高越好”？'},
  {id:'fq5.backend-db.02',familyId:'qf.backend-database-isolation',methodKey:'m5.db',difficulty:'STAFF',tags:'database concurrency transaction retry serialization conflict invariant',text:'两个并发请求都读取旧状态并准备更新同一业务对象，你会如何选择事务、锁、约束或重试策略？',pressure:'如果使用 Serializable 后出现 serialization failure，应用层应该怎么处理？'},
  {id:'fq5.backend-reliability.01',familyId:'qf.backend-reliability-idempotency',methodKey:'m5.reliability',difficulty:'SENIOR',tags:'backend reliability timeout retry unknown outcome idempotency side effect',text:'一次写请求客户端超时，但服务端是否成功未知，你会如何处理“未知结果”而不是直接重试？',pressure:'如果这个操作会扣款、发消息或创建资源，你需要什么 identity 和去重语义？'},
  {id:'fq5.backend-reliability.02',familyId:'qf.backend-reliability-idempotency',methodKey:'m5.reliability',difficulty:'STAFF',tags:'reliability retry budget backoff degradation observability failure recovery',text:'超时、重试和降级为什么可能互相放大故障？你会如何设置 retry budget 和观测停止条件？',pressure:'如果下游已经过载，客户端指数退避是不是就一定安全？'},
  {id:'fq5.frontend-react.01',familyId:'qf.frontend-react-rendering',methodKey:'m5.react',difficulty:'SENIOR',tags:'react render commit state props context memo rerender',text:'React 组件为什么会重新 render，render 和 commit 分别发生什么？你怎么判断一次 re-render 是否真的需要优化？',pressure:'加了 memo 后组件仍可能重新 render，这是否说明 memo 失效？'},
  {id:'fq5.frontend-react.02',familyId:'qf.frontend-react-rendering',methodKey:'m5.react',difficulty:'SENIOR',tags:'react pure rendering memo useMemo correctness performance',text:'React 文档强调 render 应保持纯函数语义，这和 memo/useMemo 这类性能优化是什么关系？',pressure:'为什么业务正确性不能依赖 memoization？'},
  {id:'fq5.frontend-perf.01',familyId:'qf.frontend-performance-measurement',methodKey:'m5.perf',difficulty:'SENIOR',tags:'frontend performance core web vitals lcp inp cls field lab p75',text:'你怎样用 LCP、INP、CLS 判断真实用户性能问题，并区分 field data 和 lab data 的作用？',pressure:'Lighthouse 在你机器上变快了，为什么还不能证明线上用户体验已经改善？'},
  {id:'fq5.frontend-perf.02',familyId:'qf.frontend-performance-measurement',methodKey:'m5.perf',difficulty:'SENIOR',tags:'performance measurement p75 trace regression causal validation',text:'做前端性能优化时，你如何建立“指标变好确实来自这次修改”的因果验证链？',pressure:'如果平均值改善但 p75 用户没有改善，你会如何判断结果？'},
  {id:'fq5.frontend-testing.01',familyId:'qf.frontend-testing-strategy',methodKey:'m5.testing',difficulty:'SENIOR',tags:'frontend testing user behavior implementation details testing library',text:'前端组件测试为什么应尽量从用户可观察行为出发，而不是直接断言内部 state 或组件实例？',pressure:'完全不测实现细节，会不会让定位问题变慢？你怎么平衡？'},
  {id:'fq5.frontend-testing.02',familyId:'qf.frontend-testing-strategy',methodKey:'m5.testing',difficulty:'SENIOR',tags:'frontend testing async query get find waitFor e2e integration regression',text:'一个异步 UI 流程应该放在单测、组件集成测试还是 E2E？你会根据什么风险选择层级？',pressure:'如果同一场景三个层级都测一遍，为什么不一定是更安全？'},
];

const METHODS:MethodSeed[]=[
  {key:'m5.mcp',sourceId:'source.mcp-official',locator:'p5/mcp-tools',text:'MCP server 可以向模型暴露具名 Tool 与 input schema；Tool 由模型发现和调用，但高风险调用仍应保留清晰的人类控制和权限边界。'},
  {key:'m5.tools',sourceId:'source.openai-function-calling',locator:'p5/function-calling',text:'Function Calling 用结构化 schema 把模型连接到外部工具和系统；strict schema 约束参数结构，但真实执行和副作用仍由应用控制。'},
  {key:'m5.workflow',sourceId:'source.openai-function-calling',locator:'p5/workflow',text:'Tool Calling 可以组成多步 workflow；稳定系统需要显式管理工具结果、下一步执行和外部副作用，而不是把程序状态隐含在模型文本里。'},
  {key:'m5.rag',sourceId:'source.openai-retrieval',locator:'p5/retrieval',text:'Vector Store Search 根据 query 和 filters 返回相关 chunk 与 score；检索相关性只是 grounded answer 链路的一部分，仍需独立评测引用和最终任务正确性。'},
  {key:'m5.node',sourceId:'source.nodejs-docs',locator:'p5/node-runtime',text:'Node.js 以 Event Loop 组织异步回调；Timer 只调度未来执行机会，阻塞 Event Loop 的工作会直接影响服务端响应延迟。'},
  {key:'m5.http',sourceId:'source.mdn-http',locator:'p5/http-api',text:'HTTP method 具有 safe、idempotent、cacheable 等语义；幂等描述重复相同请求对服务端预期效果，应用仍需正确实现这些契约。'},
  {key:'m5.db',sourceId:'source.postgresql-docs',locator:'p5/db-isolation',text:'事务隔离级别通过允许或禁止不同并发现象来定义一致性边界；Serializable 最强，但应用必须处理并发冲突及可能的重试。'},
  {key:'m5.reliability',sourceId:'source.mdn-http',locator:'p5/idempotency-retry',text:'请求是否可以安全重试取决于幂等语义和副作用控制；当请求结果未知时，重复执行必须有 identity、去重或等价恢复机制。'},
  {key:'m5.react',sourceId:'source.react-docs',locator:'p5/react-render',text:'React 更新经历 render 与 commit；组件应保持纯渲染语义，memoization 是性能优化而不是业务正确性保证。'},
  {key:'m5.perf',sourceId:'source.webdev-vitals',locator:'p5/web-vitals',text:'Core Web Vitals 用 LCP、INP、CLS 从真实用户角度衡量加载、交互和视觉稳定性，并强调 field 数据及 p75 判断。'},
  {key:'m5.testing',sourceId:'source.testing-library',locator:'p5/frontend-testing',text:'测试越接近用户真实使用方式，越能提供有意义的信心；测试应优先用户可观察行为，避免过度耦合实现细节。'},
];

const ANCHORS:AnchorSeed[]=FAMILIES.flatMap(f=>[
  {id:`anchor.fq5.${f.id.slice(3)}.positive`,familyId:f.id,signalId:f.signalId,methodKey:f.methodKey,polarity:'POSITIVE' as const,behavior:`能围绕 ${f.name} 先说明机制和边界，再给出可验证的工程判断、失败路径与验证标准。`},
  {id:`anchor.fq5.${f.id.slice(3)}.negative`,familyId:f.id,signalId:f.signalId,methodKey:f.methodKey,polarity:'NEGATIVE' as const,behavior:`只背 ${f.name} 名词或 API，无法解释约束、失败语义、trade-off 和如何验证自己的判断。`},
]);

const EDGES=[
  ['edge.fq5.mcp.follow','qf.agent-mcp-tools','qf.agent-tool-calling-contract','FOLLOW_UP',95],
  ['edge.fq5.tools.follow','qf.agent-tool-calling-contract','qf.agent-workflow-boundary','FOLLOW_UP',90],
  ['edge.fq5.workflow.challenge','qf.agent-workflow-boundary','qf.backend-reliability-idempotency','CHALLENGE',85],
  ['edge.fq5.rag.challenge','qf.agent-rag-retrieval','qf.negative-eval-decision','CHALLENGE',95],
  ['edge.fq5.node.follow','qf.backend-node-runtime','qf.coding-debugging-strategy','FOLLOW_UP',80],
  ['edge.fq5.http.follow','qf.backend-http-api','qf.backend-reliability-idempotency','FOLLOW_UP',90],
  ['edge.fq5.db.follow','qf.backend-database-isolation','qf.platform-system-design','FOLLOW_UP',80],
  ['edge.fq5.reliability.follow','qf.backend-reliability-idempotency','qf.coding-debugging-strategy','FOLLOW_UP',85],
  ['edge.fq5.react.follow','qf.frontend-react-rendering','qf.frontend-performance-measurement','FOLLOW_UP',90],
  ['edge.fq5.perf.challenge','qf.frontend-performance-measurement','qf.frontend-testing-strategy','CHALLENGE',80],
  ['edge.fq5.testing.follow','qf.frontend-testing-strategy','qf.coding-debugging-strategy','FOLLOW_UP',80],
] as const;

function registerMethodUnits(db:any,now:string){
  registerAuditedInterviewSources(db,now);
  const out=new Map<string,string>();
  for(const method of METHODS){
    const source:any=db.prepare('SELECT canonical_url,name FROM interview_sources WHERE id=?').get(method.sourceId);
    if(!source) throw new Error(`P5_SOURCE_MISSING:${method.sourceId}`);
    const compiled:any=compileInterviewDocument(db,{sourceId:method.sourceId,title:`P5 Gap Expansion｜${source.name}`,canonicalUrl:source.canonical_url,capturedAt:now,units:[{locator:method.locator,kind:'TECHNIQUE',text:method.text}]});
    const unit=compiled.units[0]; if(!unit?.unitId) throw new Error(`P5_SOURCE_UNIT_MISSING:${method.key}`);
    out.set(method.key,unit.unitId);
  }
  return out;
}

export function registerFormalQuestionCorpusP5(db:any,now=new Date().toISOString()){
  registerFormalQuestionCorpusWave4(db,now);
  const methodUnits=registerMethodUnits(db,now);
  db.exec('BEGIN;');
  try{
    const family=db.prepare(`INSERT INTO interview_question_families(id,name,primary_signal_id,normalized_intent,decision_pattern,lifecycle,version,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,primary_signal_id=excluded.primary_signal_id,normalized_intent=excluded.normalized_intent,decision_pattern=excluded.decision_pattern,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of FAMILIES) family.run(row.id,row.name,row.signalId,row.intent,row.decisionPattern,now,now);
    const question=db.prepare(`INSERT INTO interview_questions(id,question_family_id,source_unit_id,canonical_text,language,difficulty,lifecycle,created_at,updated_at) VALUES(?,?,?,?,'zh-CN',?,'ACTIVE',?,?) ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,source_unit_id=excluded.source_unit_id,canonical_text=excluded.canonical_text,difficulty=excluded.difficulty,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const variant=db.prepare(`INSERT INTO interview_question_variants(id,question_id,source_unit_id,text,tone,pressure_mode,language,lifecycle,created_at,updated_at) VALUES(?,?,?,?,'DIRECT','PRESSURE','zh-CN','ACTIVE',?,?) ON CONFLICT(id) DO UPDATE SET source_unit_id=excluded.source_unit_id,text=excluded.text,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const search=db.prepare(`INSERT INTO interview_question_search(item_type,item_id,family_id,text,tags,signal_terms) VALUES('QUESTION',?,?,?,?,?)`);
    for(const row of QUESTIONS){
      const unitId=methodUnits.get(row.methodKey); if(!unitId) throw new Error(`P5_METHOD_NOT_FOUND:${row.methodKey}`);
      question.run(row.id,row.familyId,unitId,row.text,row.difficulty,now,now); variant.run(`fq5v.${row.id.slice(4)}`,row.id,unitId,row.pressure,now,now);
      const signal:any=db.prepare(`SELECT s.id,s.name FROM interview_question_families f LEFT JOIN interview_signals s ON s.id=f.primary_signal_id WHERE f.id=?`).get(row.familyId);
      db.prepare("DELETE FROM interview_question_search WHERE item_type='QUESTION' AND item_id=?").run(row.id); search.run(row.id,row.familyId,`${row.text} ${row.pressure}`,row.tags,`${signal?.id??''} ${signal?.name??''}`);
    }
    const anchor=db.prepare(`INSERT INTO interview_scoring_anchors(id,question_family_id,signal_id,source_unit_id,polarity,observable_behavior,lifecycle,created_at,updated_at) VALUES(?,?,?,?,?,?,'ACTIVE',?,?) ON CONFLICT(id) DO UPDATE SET source_unit_id=excluded.source_unit_id,polarity=excluded.polarity,observable_behavior=excluded.observable_behavior,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of ANCHORS){ const unitId=methodUnits.get(row.methodKey); if(!unitId) throw new Error(`P5_ANCHOR_METHOD_NOT_FOUND:${row.methodKey}`); anchor.run(row.id,row.familyId,row.signalId,unitId,row.polarity,row.behavior,now,now); }
    const edge=db.prepare(`INSERT INTO interview_question_edges(id,from_question_family_id,to_question_family_id,to_question_id,edge_type,priority,condition_json,lifecycle,created_at,updated_at) VALUES(?,?,?,NULL,?,?,'{}','ACTIVE',?,?) ON CONFLICT(id) DO UPDATE SET from_question_family_id=excluded.from_question_family_id,to_question_family_id=excluded.to_question_family_id,edge_type=excluded.edge_type,priority=excluded.priority,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const [id,from,to,type,priority] of EDGES) edge.run(id,from,to,type,priority,now,now);
    db.exec('COMMIT;'); return {families:FAMILIES.length,questions:QUESTIONS.length,variants:QUESTIONS.length,scoringAnchors:ANCHORS.length,edges:EDGES.length,methodUnits:methodUnits.size};
  }catch(error){ try{db.exec('ROLLBACK;')}catch{} throw error; }
}
