type TopicSeed={id:string;domainId:string;name:string;description:string};
type ExpectationSeed={routeId:string;topicId:string;expectation:'CORE'|'IMPORTANT'|'OPTIONAL';rationale:string};
type FamilyTopicSeed={familyId:string;topicId:string;relationType:'PRIMARY'|'SUPPORTING'};

export const INTERVIEW_KNOWLEDGE_TOOL_CONTRACTS={
  'interview.audit_knowledge_coverage':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

const TOPICS:TopicSeed[]=( [
  ['agent.runtime','agent-ai','Agent Runtime','Agent 执行、恢复、状态与运行时边界'],
  ['agent.context','agent-ai','Context Engineering','上下文获取、压缩、按需下钻与可追溯访问'],
  ['agent.tool-calling','agent-ai','Tool Calling','工具选择、参数契约、失败与副作用边界'],
  ['agent.mcp','agent-ai','MCP','MCP 协议、工具发现、权限和集成'],
  ['agent.workflow','agent-ai','Workflow','确定性流程、状态机、编排与人机边界'],
  ['agent.memory','agent-ai','Memory','长期记忆、工作记忆、写入边界与召回'],
  ['agent.skill','agent-ai','Agent Skill','可发现技能、渐进加载、程序性知识与版本维护'],
  ['agent.prompt-engineering','agent-ai','Prompt Engineering','任务约束、示例、结构化提示、评测与版本回归'],
  ['agent.rag','agent-ai','RAG','检索、切分、召回、重排、引用与评测'],
  ['agent.eval','agent-ai','Eval','评测设计、负例、回归与真实性'],
  ['agent.observability','agent-ai','Observability','事件、指标、证据、审计与运行观测'],
  ['agent.multi-agent','agent-ai','Multi-Agent','多智能体职责、协调、authority 与失败恢复'],
  ['agent.devtools-value','agent-ai','Developer Tools Value','研发工具价值、采用率、可靠性与停止标准'],

  ['frontend.javascript-typescript','frontend','JavaScript / TypeScript','语言、类型、异步与工程语义'],
  ['frontend.browser-runtime','frontend','Browser Runtime','事件循环、渲染、状态与浏览器执行模型'],
  ['frontend.react','frontend','React','组件、状态、渲染与架构边界'],
  ['frontend.performance','frontend','Frontend Performance','加载、渲染、性能诊断与验证'],
  ['frontend.testing','frontend','Frontend Testing','单测、集成、E2E 与回归策略'],
  ['frontend.engineering','frontend','Frontend Engineering','构建、依赖、模块化、发布与工程治理'],
  ['frontend.platform-migration','frontend','Platform Migration','大型前端迁移、兼容、灰度与收尾'],
  ['frontend.fullstack-boundary','frontend','Frontend / Full-stack Boundary','前端与 Node/服务端职责边界'],

  ['backend.node-runtime','backend-fullstack','Node Runtime','Node runtime、event loop、process 与 server execution'],
  ['backend.http-api','backend-fullstack','HTTP / API','HTTP、API contract、错误语义与幂等'],
  ['backend.database','backend-fullstack','Database','数据模型、事务、索引与查询'],
  ['backend.cache','backend-fullstack','Cache','缓存策略、一致性、失效与击穿'],
  ['backend.queue','backend-fullstack','Queue / Messaging','消息、队列、重试与消费语义'],
  ['backend.auth','backend-fullstack','Auth','身份、认证、授权与权限边界'],
  ['backend.concurrency','backend-fullstack','Concurrency','并发、竞态、限流与资源控制'],
  ['backend.reliability','backend-fullstack','Reliability','超时、重试、降级、观测与恢复'],
  ['backend.distributed-basics','backend-fullstack','Distributed Basics','分布式状态、分区、协调与一致性基础'],

  ['system-design.requirements-tradeoff','system-design','Requirements / Trade-off','需求澄清、约束、质量属性与取舍'],
  ['system-design.data-state','system-design','Data / State','数据、状态、authority 与生命周期'],
  ['system-design.consistency','system-design','Consistency','一致性、事务与跨边界同步'],
  ['system-design.cache-messaging','system-design','Cache / Messaging','缓存和消息在系统设计中的取舍'],
  ['system-design.reliability','system-design','Reliability / Evolution','失败模式、可观测、扩展与演进'],

  ['coding.debugging','coding-debugging','Debugging','复现、定位、因果验证、回归与发布后观察'],
  ['coding.typescript','coding-debugging','TypeScript Coding','TypeScript 实现、类型建模与可维护性'],
  ['coding.async-concurrency','coding-debugging','Async / Concurrency Coding','异步、并发与错误处理'],
  ['coding.testing','coding-debugging','Testing Design','测试层级、边界、回归与失败诊断'],

  ['fde.requirements','fde-tob','FDE Requirement Decomposition','客户目标、约束与可验收需求分解'],
  ['fde.risk-control','fde-tob','FDE Risk Control','交付风险、依赖、故障与验收控制'],
  ['fde.customer-case','fde-tob','FDE Customer Case','开放式客户 Case 的澄清、方案与交付'],
  ['fde.value','fde-tob','FDE Value','技术动作到客户/业务/交付价值'],

  ['career.recruiter-risk','career-interview','Recruiter Risk','职业动机、约束、稳定性与风险一致性'],
  ['career.offer-negotiation','career-interview','Offer Negotiation','BATNA、目标、保留点、ZOPA 与多变量谈判'],
  ['career.due-diligence','career-interview','Candidate Due Diligence','岗位、团队、流程、成功标准与组织风险的反向尽调'],
  ['career.claim-boundary','career-interview','Claim Boundary','真实性、强 claim、证据边界与禁止扩大'],
  ['career.jd-fit','career-interview','JD Fit','岗位要求到 Evidence、可迁移能力与 Gap 的映射'],
] as Array<[string,string,string,string]>).map(([id,domainId,name,description])=>({id,domainId,name,description}));

const F=(familyId:string,topicId:string,relationType:'PRIMARY'|'SUPPORTING'='PRIMARY'):FamilyTopicSeed=>({familyId,topicId,relationType});
const FAMILY_TOPICS:FamilyTopicSeed[]=[
  F('qf.agent-runtime-recovery','agent.runtime'),
  F('qf.architecture-restart-judgment','system-design.requirements-tradeoff'),
  F('qf.behavior-ownership-continuity','career.claim-boundary'),
  F('qf.candidate-due-diligence','career.due-diligence'),
  F('qf.claim-risk-boundary','career.claim-boundary'),
  F('qf.coding-debugging-strategy','coding.debugging'),
  F('qf.context-access-strategy','agent.context'),
  F('qf.devtools-value-adoption','agent.devtools-value'),
  F('qf.fde-case-response','fde.customer-case'),
  F('qf.fde-requirement-decomposition','fde.requirements'),
  F('qf.fde-risk-control','fde.risk-control'),
  F('qf.frontend-platform-migration','frontend.platform-migration'),
  F('qf.frontend-runtime-baseline','frontend.browser-runtime'),
  F('qf.frontend-runtime-baseline','frontend.javascript-typescript','SUPPORTING'),
  F('qf.fullstack-boundary','frontend.fullstack-boundary'),
  F('qf.fullstack-boundary','backend.node-runtime','SUPPORTING'),
  F('qf.jd-role-fit-mapping','career.jd-fit'),
  F('qf.negative-eval-decision','agent.eval'),
  F('qf.observability-truth','agent.observability'),
  F('qf.offer-negotiation','career.offer-negotiation'),
  F('qf.platform-system-design','system-design.requirements-tradeoff'),
  F('qf.platform-system-design','system-design.reliability','SUPPORTING'),
  F('qf.recruiter-career-constraint-risk','career.recruiter-risk'),
  F('qf.value-evidence','fde.value'),

  F('qf.agent-mcp-tools','agent.mcp'),
  F('qf.agent-tool-calling-contract','agent.tool-calling'),
  F('qf.agent-workflow-boundary','agent.workflow'),
  F('qf.agent-rag-retrieval','agent.rag'),
  F('qf.agent-skill-lifecycle','agent.skill'),
  F('qf.agent-multi-agent-orchestration','agent.multi-agent'),
  F('qf.agent-memory-strategy','agent.memory'),
  F('qf.prompt-engineering-eval','agent.prompt-engineering'),
  F('qf.backend-node-runtime','backend.node-runtime'),
  F('qf.backend-http-api','backend.http-api'),
  F('qf.backend-database-isolation','backend.database'),
  F('qf.backend-reliability-idempotency','backend.reliability'),
  F('qf.frontend-react-rendering','frontend.react'),
  F('qf.frontend-performance-measurement','frontend.performance'),
  F('qf.frontend-testing-strategy','frontend.testing'),
  F('qf.coding-typescript-modeling','coding.typescript'),
  F('qf.coding-async-concurrency','coding.async-concurrency'),
  F('qf.coding-testing-design','coding.testing'),
  F('qf.backend-auth-boundary','backend.auth'),
  F('qf.backend-cache-consistency','backend.cache'),
  F('qf.backend-concurrency-control','backend.concurrency'),
  F('qf.frontend-engineering-build','frontend.engineering'),
  F('qf.system-data-state-authority','system-design.data-state'),
  F('qf.system-consistency-boundary','system-design.consistency'),
];

const EXPECTED:Record<string,{core:string[];important:string[]}>={
  'route.ai-agent-devtools':{
    core:['agent.runtime','agent.context','agent.tool-calling','agent.mcp','agent.workflow','agent.rag','agent.eval','agent.observability','agent.devtools-value','coding.debugging','coding.typescript','backend.node-runtime','backend.http-api','backend.reliability'],
    important:['agent.skill','agent.memory','agent.multi-agent','agent.prompt-engineering','coding.async-concurrency','coding.testing','system-design.requirements-tradeoff','system-design.data-state','career.jd-fit'],
  },
  'route.advanced-fe-fullstack':{
    core:['frontend.javascript-typescript','frontend.browser-runtime','frontend.react','frontend.performance','frontend.testing','frontend.engineering','frontend.platform-migration','frontend.fullstack-boundary','backend.node-runtime','backend.http-api','backend.database','backend.cache','backend.auth','backend.concurrency','backend.reliability','coding.debugging','coding.typescript','coding.async-concurrency','coding.testing'],
    important:['agent.skill','backend.queue','backend.distributed-basics','system-design.requirements-tradeoff','system-design.data-state','system-design.reliability','career.jd-fit'],
  },
  'route.tob-fde':{
    core:['fde.requirements','fde.risk-control','fde.customer-case','fde.value','system-design.requirements-tradeoff','system-design.data-state','system-design.consistency','system-design.reliability','backend.http-api','backend.database','backend.reliability','coding.debugging'],
    important:['backend.cache','backend.queue','backend.auth','backend.distributed-basics','agent.tool-calling','agent.mcp','agent.workflow','agent.rag','career.jd-fit'],
  },
};

const EXPECTATIONS:ExpectationSeed[]=Object.entries(EXPECTED).flatMap(([routeId,value])=>[
  ...value.core.map((topicId)=>({routeId,topicId,expectation:'CORE' as const,rationale:'目标岗位稳定核心能力'})),
  ...value.important.map((topicId)=>({routeId,topicId,expectation:'IMPORTANT' as const,rationale:'目标岗位高频加分或迁移能力'})),
]);

const FAMILY_SOURCE:Record<string,string>={
  'qf.agent-runtime-recovery':'source.karat',
  'qf.architecture-restart-judgment':'source.staffeng',
  'qf.behavior-ownership-continuity':'source.feishu-hire',
  'qf.candidate-due-diligence':'source.reverse-interview',
  'qf.claim-risk-boundary':'source.eng-rubrics',
  'qf.coding-debugging-strategy':'source.tech-interview-handbook',
  'qf.context-access-strategy':'source.karat',
  'qf.devtools-value-adoption':'source.staffeng',
  'qf.fde-case-response':'source.system-design-primer',
  'qf.fde-requirement-decomposition':'source.feishu-hire',
  'qf.fde-risk-control':'source.system-design-primer',
  'qf.frontend-platform-migration':'source.frontend-interview-handbook',
  'qf.frontend-runtime-baseline':'source.frontend-interview-handbook',
  'qf.fullstack-boundary':'source.frontend-interview-handbook',
  'qf.jd-role-fit-mapping':'source.feishu-hire',
  'qf.negative-eval-decision':'source.staffeng',
  'qf.observability-truth':'source.karat',
  'qf.offer-negotiation':'source.harvard-pon',
  'qf.platform-system-design':'source.system-design-primer',
  'qf.recruiter-career-constraint-risk':'source.feishu-hire',
  'qf.value-evidence':'source.staffeng',
};

export function registerInterviewKnowledgeTaxonomy(db:any,now=new Date().toISOString()){
  const topic=db.prepare(`INSERT INTO interview_knowledge_topics(
    id,domain_id,name,description,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,?,'ACTIVE',?,?)
  ON CONFLICT(id) DO UPDATE SET domain_id=excluded.domain_id,name=excluded.name,description=excluded.description,
    lifecycle='ACTIVE',updated_at=excluded.updated_at`);
  for(const row of TOPICS) topic.run(row.id,row.domainId,row.name,row.description,now,now);

  const expected=db.prepare(`INSERT INTO interview_topic_route_expectations(
    id,topic_id,route_id,expectation,rationale,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,?,?,'ACTIVE',?,?)
  ON CONFLICT(topic_id,route_id) DO UPDATE SET expectation=excluded.expectation,rationale=excluded.rationale,
    lifecycle='ACTIVE',updated_at=excluded.updated_at`);
  for(const row of EXPECTATIONS) expected.run(`expect.${row.routeId}.${row.topicId}`,row.topicId,row.routeId,row.expectation,row.rationale,now,now);

  const link=db.prepare(`INSERT INTO interview_family_topic_links(
    id,question_family_id,topic_id,relation_type,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,?,'ACTIVE',?,?)
  ON CONFLICT(question_family_id,topic_id) DO UPDATE SET relation_type=excluded.relation_type,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
  for(const row of FAMILY_TOPICS){
    if(db.prepare("SELECT 1 FROM interview_question_families WHERE id=? AND lifecycle='ACTIVE'").get(row.familyId)){
      link.run(`ft.${row.familyId}.${row.topicId}`,row.familyId,row.topicId,row.relationType,now,now);
    }
  }

  const sourceUnit=db.prepare(`SELECT u.id FROM interview_source_units u
    JOIN interview_source_documents d ON d.id=u.source_document_id
    WHERE d.source_id=? AND u.lifecycle='ACTIVE'
    ORDER BY COALESCE(d.captured_at,'') DESC,u.id LIMIT 1`);
  const sourceLink=db.prepare(`INSERT INTO interview_family_source_links(
    id,question_family_id,source_unit_id,relation_type,is_primary,note,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,'METHOD_SUPPORT',1,?,'ACTIVE',?,?)
  ON CONFLICT(question_family_id,source_unit_id,relation_type) DO UPDATE SET
    is_primary=1,note=excluded.note,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
  for(const [familyId,sourceId] of Object.entries(FAMILY_SOURCE)){
    const unit:any=sourceUnit.get(sourceId);
    if(unit&&db.prepare("SELECT 1 FROM interview_question_families WHERE id=? AND lifecycle='ACTIVE'").get(familyId)){
      sourceLink.run(`fs.${familyId}.${unit.id}`,familyId,unit.id,`Method support from ${sourceId}.`,now,now);
    }
  }
}

function routeExecutableFamilies(db:any,routeId:string){
  const rows:any[]=db.prepare(`SELECT DISTINCT q.question_family_id family_id,
    MAX(CASE WHEN q.id GLOB 'fq[5-8].*' THEN 1 ELSE 0 END) expansion
    FROM interview_questions q
    WHERE q.lifecycle='ACTIVE' AND q.id GLOB 'fq[1-8].*'
    GROUP BY q.question_family_id`).all() as any[];
  const result=new Set<string>();
  const counts=db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN route_id=? THEN 1 ELSE 0 END) routed
    FROM interview_question_evidence_links WHERE question_family_id=? AND lifecycle='ACTIVE'`);
  for(const row of rows){
    if(Number(row.expansion)===1){
      const eligible=db.prepare(`SELECT 1 ok FROM interview_family_topic_links l
        JOIN interview_topic_route_expectations e ON e.topic_id=l.topic_id
        WHERE l.question_family_id=? AND l.lifecycle='ACTIVE' AND e.route_id=? AND e.lifecycle='ACTIVE' LIMIT 1`)
        .get(row.family_id,routeId);
      if(eligible)result.add(row.family_id);
      continue;
    }
    const count:any=counts.get(routeId,row.family_id);
    if(Number(count.total)===0||Number(count.routed)>0)result.add(row.family_id);
  }
  return result;
}

export function auditInterviewKnowledgeCoverage(db:any,input:{routeId:string},now=new Date().toISOString()){
  const route=db.prepare("SELECT id FROM interview_role_profiles WHERE id=? AND lifecycle='ACTIVE'").get(input.routeId);
  if(!route)throw new Error('INTERVIEW_ROUTE_NOT_FOUND');

  const executable=routeExecutableFamilies(db,input.routeId);
  const familyTopics:any[]=db.prepare("SELECT question_family_id,topic_id FROM interview_family_topic_links WHERE lifecycle='ACTIVE'").all() as any[];
  const covered=new Set(familyTopics.filter((row)=>executable.has(row.question_family_id)).map((row)=>row.topic_id));
  const expected:any[]=db.prepare(`SELECT e.topic_id,e.expectation,t.domain_id,t.name
    FROM interview_topic_route_expectations e
    JOIN interview_knowledge_topics t ON t.id=e.topic_id
    WHERE e.route_id=? AND e.lifecycle='ACTIVE' AND t.lifecycle='ACTIVE'
    ORDER BY t.domain_id,CASE e.expectation WHEN 'CORE' THEN 1 WHEN 'IMPORTANT' THEN 2 ELSE 3 END,t.id`).all(input.routeId) as any[];

  const grouped=new Map<string,any>();
  for(const row of expected){
    const group=grouped.get(row.domain_id)??{domainId:row.domain_id,expectedTopics:0,coveredTopics:0,missingTopics:[]};
    group.expectedTopics++;
    if(covered.has(row.topic_id))group.coveredTopics++;
    else group.missingTopics.push({topicId:row.topic_id,name:row.name,expectation:row.expectation});
    grouped.set(row.domain_id,group);
  }

  const sources:any[]=db.prepare(`SELECT s.id,s.name,s.last_verified_at,COUNT(d.id) documents,MAX(d.captured_at) last_capture
    FROM interview_sources s LEFT JOIN interview_source_documents d ON d.source_id=s.id
    GROUP BY s.id,s.name,s.last_verified_at ORDER BY s.id`).all() as any[];
  const formal:any=db.prepare(`SELECT COUNT(DISTINCT question_family_id) families,COUNT(*) questions
    FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-4].*'`).get();
  const expanded:any=db.prepare(`SELECT COUNT(DISTINCT question_family_id) families,COUNT(*) questions,
    SUM(CASE WHEN source_unit_id IS NOT NULL THEN 1 ELSE 0 END) direct
    FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-8].*'`).get();
  const familySupport=Number((db.prepare(`SELECT COUNT(DISTINCT l.question_family_id) c
    FROM interview_family_source_links l JOIN interview_questions q ON q.question_family_id=l.question_family_id
    WHERE l.lifecycle='ACTIVE' AND q.lifecycle='ACTIVE' AND q.id GLOB 'fq[1-8].*'`).get() as any).c);

  return{
    routeId:input.routeId,
    asOf:now,
    coverageModel:'Knowledge Topic × Route Expectation × Executable Formal Family',
    formalCorpus:{families:Number(formal.families),questions:Number(formal.questions),legacyStructuralGapStatus:'PRESERVED_SEPARATELY'},
    knowledgeCorpus:{families:Number(expanded.families),questions:Number(expanded.questions)},
    domains:[...grouped.values()],
    provenance:{
      directQuestionSourceUnits:Number(expanded.direct??0),
      familySupportCovered:familySupport,
      familySupportTotal:Number(expanded.families),
      directFamilySourceCovered:0,
      familySupportSemantics:'PUBLIC_METHOD_SUPPORT',
    },
    sources,
  };
}
