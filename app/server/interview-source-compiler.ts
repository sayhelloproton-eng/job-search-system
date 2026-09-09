import { createHash } from 'node:crypto';

type Grade = 'A'|'B'|'C';
type UnitKind = 'QUESTION'|'RUBRIC'|'TECHNIQUE'|'NEGOTIATION'|'MARKET_OBSERVATION'|'SCORING_ANCHOR'|'FOLLOW_UP'|'OTHER';

type AuditedSource = {
  id:string; name:string; grade:Grade; sourceType:string; authorOrOrg:string;
  canonicalUrl:string; language?:string; trustNote:string; lifecycle?:'ACTIVE'|'OBSERVATION_ONLY';
};

type SourceUnitInput = { locator:string; kind:UnitKind; text:string };
type SourceDocumentInput = {
  sourceId:string; title:string; canonicalUrl:string; publishedAt?:string; capturedAt:string;
  contentHash?:string; units:SourceUnitInput[];
};

const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const shortHash = (value:string) => hash(value).slice(0, 20);

export const AUDITED_INTERVIEW_SOURCES: AuditedSource[] = [
  { id:'source.feishu-hire', name:'飞书招聘', grade:'A', sourceType:'RECRUITER_METHOD', authorOrOrg:'飞书招聘', canonicalUrl:'https://hire.feishu.cn/blog/goodinterview', trustNote:'结构化面试、能力标签与跨轮补证。' },
  { id:'source.eng-rubrics', name:'Engineering Interview Rubrics', grade:'B', sourceType:'OPEN_RUBRIC', authorOrOrg:'Ricky Stevens', canonicalUrl:'https://github.com/Ricky-Stevens/eng-rubrics', trustNote:'行为锚点与 scorecard；不直接套定级。' },
  { id:'source.staffeng', name:'StaffEng', grade:'A', sourceType:'SENIOR_METHOD', authorOrOrg:'StaffEng', canonicalUrl:'https://staffeng.com/guides/staff-plus-interview-process/', trustNote:'Staff+ Judgment 等高级 Signal。' },
  { id:'source.karat', name:'Karat Human+AI Rubric', grade:'A', sourceType:'TECH_RUBRIC', authorOrOrg:'Karat', canonicalUrl:'https://karat.com/resource/human-ai-technical-interview-rubrics/', trustNote:'AI 时代工程判断与验证能力评价。' },
  { id:'source.harvard-pon', name:'Harvard Program on Negotiation', grade:'A', sourceType:'NEGOTIATION_RESEARCH', authorOrOrg:'Harvard PON', canonicalUrl:'https://www.pon.harvard.edu/daily/negotiation-skills-daily/when-to-make-the-first-offer-in-negotiation/', trustNote:'BATNA、ZOPA、Anchor 与信息不对称。' },
  { id:'source.levels', name:'Levels.fyi Negotiation Guide', grade:'A', sourceType:'OFFER_METHOD', authorOrOrg:'Levels.fyi', canonicalUrl:'https://www.levels.fyi/blog/ultimate-negotiation-guide.html', trustNote:'Tech compensation 与 Offer process；不直接迁移海外数字。' },
  { id:'source.aipm-wiki', name:'AIPM Wiki', grade:'B', sourceType:'QUESTION_SCHEMA', authorOrOrg:'AIPM Wiki', canonicalUrl:'https://github.com/archlizheng/AIPM-Wiki', trustNote:'题目→考察点→追问网络；答案不替代个人 Evidence。' },
  { id:'source.tech-interview-handbook', name:'Tech Interview Handbook', grade:'B', sourceType:'QUESTION_CORPUS', authorOrOrg:'yangshun', canonicalUrl:'https://github.com/yangshun/tech-interview-handbook', trustNote:'Coding/Behavioral 通用题源。' },
  { id:'source.frontend-interview-handbook', name:'Front End Interview Handbook', grade:'B', sourceType:'QUESTION_CORPUS', authorOrOrg:'yangshun', canonicalUrl:'https://github.com/yangshun/front-end-interview-handbook', trustNote:'Frontend、Design、Coding 题源。' },
  { id:'source.system-design-primer', name:'System Design Primer', grade:'B', sourceType:'QUESTION_CORPUS', authorOrOrg:'donnemartin', canonicalUrl:'https://github.com/donnemartin/system-design-primer', trustNote:'开放式 System Design 方法与练习题源。' },
  { id:'source.reverse-interview', name:'Reverse Interview', grade:'B', sourceType:'DUE_DILIGENCE', authorOrOrg:'viraptor', canonicalUrl:'https://github.com/viraptor/reverse-interview', trustNote:'候选人反向尽调问题维度。' },
  { id:'source.exponent-fde', name:'Exponent FDE Interview Guide', grade:'C', sourceType:'MARKET_OBSERVATION', authorOrOrg:'Exponent', canonicalUrl:'https://www.tryexponent.com/guides/palantir-forward-deployed-engineer-interview', trustNote:'FDE loop 当前候选人/社区观察，不视为官方固定流程。', lifecycle:'OBSERVATION_ONLY' },
  { id:'source.nowcoder', name:'牛客近期面经', grade:'C', sourceType:'MARKET_OBSERVATION', authorOrOrg:'牛客社区', canonicalUrl:'https://www.nowcoder.com/discuss/923168327453642752', trustNote:'2026 社招问法分布样本，不能外推全市场。', lifecycle:'OBSERVATION_ONLY' },
  { id:'source.offerloop', name:'OfferLoop', grade:'B', sourceType:'TRAINING_WORKFLOW', authorOrOrg:'riwonswain-ovo', canonicalUrl:'https://github.com/riwonswain-ovo/OfferLoop', trustNote:'Prep→Mock→Review 工作流参考。' },
  { id:'source.mcp-official', name:'Model Context Protocol Specification', grade:'A', sourceType:'TECH_SPEC', authorOrOrg:'Model Context Protocol', canonicalUrl:'https://modelcontextprotocol.io/specification/2025-11-25/server/tools', trustNote:'MCP Tool discovery/call schema、安全与 human-in-the-loop 的协议真源。' },
  { id:'source.openai-function-calling', name:'OpenAI Function Calling', grade:'A', sourceType:'PLATFORM_DOC', authorOrOrg:'OpenAI', canonicalUrl:'https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api', trustNote:'Tool/function calling、schema 与外部系统连接的官方文档。' },
  { id:'source.openai-retrieval', name:'OpenAI Vector Store Search', grade:'A', sourceType:'PLATFORM_DOC', authorOrOrg:'OpenAI', canonicalUrl:'https://developers.openai.com/api/reference/typescript/resources/vector_stores/methods/search', trustNote:'检索结果、过滤、score 与 chunk 返回语义的官方参考。' },
  { id:'source.anthropic-agent-skills', name:'Anthropic Agent Skills', grade:'A', sourceType:'AGENT_ENGINEERING_REFERENCE', authorOrOrg:'Anthropic', canonicalUrl:'https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills', trustNote:'Agent Skill 的组织、发现、渐进加载与上下文经济学官方工程说明。' },
  { id:'source.openai-agents-orchestration', name:'OpenAI Agents SDK Orchestration', grade:'A', sourceType:'AGENT_ENGINEERING_REFERENCE', authorOrOrg:'OpenAI', canonicalUrl:'https://openai.github.io/openai-agents-python/multi_agent/', trustNote:'Agents as tools、handoffs 与代码/模型编排取舍的官方 SDK 文档。' },
  { id:'source.openai-agents-sessions', name:'OpenAI Agents SDK Sessions', grade:'A', sourceType:'AGENT_ENGINEERING_REFERENCE', authorOrOrg:'OpenAI', canonicalUrl:'https://openai.github.io/openai-agents-python/running_agents/', trustNote:'Session、conversation state 与跨 turn 持久化策略的官方 SDK 文档。' },
  { id:'source.openai-agents-running', name:'OpenAI Agents SDK Running Agents', grade:'A', sourceType:'AGENT_RUNTIME_REFERENCE', authorOrOrg:'OpenAI', canonicalUrl:'https://openai.github.io/openai-agents-python/running_agents/', trustNote:'Agent loop、final output、max_turns、取消与运行异常的官方 SDK 文档。' },
  { id:'source.microsoft-graphrag', name:'Microsoft GraphRAG', grade:'A', sourceType:'RAG_ARCHITECTURE_REFERENCE', authorOrOrg:'Microsoft', canonicalUrl:'https://microsoft.github.io/graphrag/', trustNote:'GraphRAG 索引结构与 Local/Global/DRIFT/Basic 查询模式的官方工程文档。' },
  { id:'source.mdn-eventsource', name:'MDN EventSource', grade:'A', sourceType:'WEB_STREAMING_REFERENCE', authorOrOrg:'MDN Web Docs', canonicalUrl:'https://developer.mozilla.org/en-US/docs/Web/API/EventSource', trustNote:'SSE/EventSource 持久 HTTP 连接、text/event-stream 与单向 server→client 数据流的 Web API 参考。' },
  { id:'source.anthropic-prompting', name:'Anthropic Prompting Best Practices', grade:'A', sourceType:'PROMPT_ENGINEERING_REFERENCE', authorOrOrg:'Anthropic', canonicalUrl:'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables', trustNote:'清晰约束、示例、结构化提示与迭代验证的官方 Prompt 工程指南。' },
  { id:'source.nodejs-docs', name:'Node.js Documentation', grade:'A', sourceType:'TECH_DOC', authorOrOrg:'OpenJS Foundation', canonicalUrl:'https://nodejs.org/api/timers.html', trustNote:'Node Runtime、Event Loop 与 Timer 语义的官方文档。' },
  { id:'source.mdn-http', name:'MDN HTTP Reference', grade:'A', sourceType:'WEB_STANDARD_REFERENCE', authorOrOrg:'MDN Web Docs', canonicalUrl:'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods', trustNote:'HTTP method、safe/idempotent/cacheable 与 API 语义参考。' },
  { id:'source.postgresql-docs', name:'PostgreSQL Documentation', grade:'A', sourceType:'DATABASE_REFERENCE', authorOrOrg:'PostgreSQL Global Development Group', canonicalUrl:'https://www.postgresql.org/docs/18/transaction-iso.html', trustNote:'事务隔离与并发控制的官方数据库参考。' },
  { id:'source.react-docs', name:'React Documentation', grade:'A', sourceType:'FRAMEWORK_REFERENCE', authorOrOrg:'React', canonicalUrl:'https://react.dev/learn/render-and-commit', trustNote:'Render/Commit、纯渲染与 memo 性能边界的官方参考。' },
  { id:'source.webdev-vitals', name:'web.dev Web Vitals', grade:'A', sourceType:'PERFORMANCE_REFERENCE', authorOrOrg:'Google Chrome', canonicalUrl:'https://web.dev/articles/vitals', trustNote:'LCP/INP/CLS、field measurement 与性能阈值的权威工程参考。' },
  { id:'source.testing-library', name:'Testing Library', grade:'A', sourceType:'TESTING_REFERENCE', authorOrOrg:'Testing Library', canonicalUrl:'https://testing-library.com/docs/guiding-principles/', trustNote:'测试应接近真实用户行为、避免实现细节耦合的官方方法参考。' },
  { id:'source.typescript-docs', name:'TypeScript Handbook', grade:'A', sourceType:'LANGUAGE_REFERENCE', authorOrOrg:'Microsoft', canonicalUrl:'https://www.typescriptlang.org/docs/handbook/2/narrowing', trustNote:'Type narrowing、泛型与静态类型建模的官方语言参考。' },
  { id:'source.nodejs-async', name:'Node.js Async Work Guide', grade:'A', sourceType:'RUNTIME_REFERENCE', authorOrOrg:'OpenJS Foundation', canonicalUrl:'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop', trustNote:'Event Loop / Worker Pool、阻塞、公平调度与服务端并发的官方工程指南。' },
  { id:'source.node-test', name:'Node.js Test Runner', grade:'A', sourceType:'TESTING_REFERENCE', authorOrOrg:'OpenJS Foundation', canonicalUrl:'https://nodejs.org/api/test.html', trustNote:'Node 内置测试运行器、异步测试、隔离与执行模型的官方参考。' },
  { id:'source.owasp-auth', name:'OWASP Authorization Cheat Sheet', grade:'A', sourceType:'SECURITY_REFERENCE', authorOrOrg:'OWASP Foundation', canonicalUrl:'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html', trustNote:'认证/授权分离、least privilege、deny by default、每请求权限校验的安全参考。' },
  { id:'source.redis-cache', name:'Redis Caching Documentation', grade:'A', sourceType:'CACHE_REFERENCE', authorOrOrg:'Redis', canonicalUrl:'https://redis.io/docs/latest/develop/clients/client-side-caching/', trustNote:'缓存读取、失效通知与数据源更新后的缓存一致性官方参考。' },
  { id:'source.vite-docs', name:'Vite Production Build', grade:'A', sourceType:'FRONTEND_ENGINEERING_REFERENCE', authorOrOrg:'Vite', canonicalUrl:'https://vite.dev/guide/build', trustNote:'现代前端构建、production bundle、兼容目标、base path 与 library build 的官方参考。' },
];

const SOURCE_REFRESHED_AT = '2026-09-08T00:00:00.000Z';

export function normalizeQuestionText(text:string) {
  return text.normalize('NFKC').trim().replace(/^\s*\d+[\.、]\s*/, '')
    .replace(/\s+/g, ' ').replace(/[，]/g, ',').replace(/[？]/g, '?')
    .replace(/[：]/g, ':').replace(/[；]/g, ';').replace(/[。]$/g, '').toLowerCase();
}
export function registerAuditedInterviewSources(db:any, now = new Date().toISOString()) {
  const stmt = db.prepare(`INSERT INTO interview_sources(
    id,name,grade,source_type,author_or_org,canonical_url,language,trust_note,last_verified_at,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,grade=excluded.grade,source_type=excluded.source_type,
    author_or_org=excluded.author_or_org,canonical_url=excluded.canonical_url,language=excluded.language,
    trust_note=excluded.trust_note,last_verified_at=excluded.last_verified_at,lifecycle=excluded.lifecycle,updated_at=excluded.updated_at`);
  for (const source of AUDITED_INTERVIEW_SOURCES) stmt.run(
    source.id, source.name, source.grade, source.sourceType, source.authorOrOrg, source.canonicalUrl,
    source.language ?? 'zh-CN', source.trustNote, SOURCE_REFRESHED_AT, source.lifecycle ?? 'ACTIVE', now, now
  );
}

const FAMILY_RULES = [
  { id:'qf.build-vs-buy', patterns:[/build\s*vs\s*buy/i,/自研/,/自己(实现|做|写)/,/不用.*(现成|开源|框架|方案)/,/没有采用.*(现成|开源|框架|方案)/] },
  { id:'qf.ownership', patterns:[/本人.*(负责|承担|主导|决定)/,/你.*(负责|承担|主导|决定)/,/你的.*(贡献|职责|角色)/,/谁.*(负责|决定|主导)/,/ownership/i] },
  { id:'qf.failure-tradeoff', patterns:[/失败/,/错误/,/踩坑/,/如果重来/,/重做/,/trade.?off/i,/取舍/,/权衡/] },
  { id:'qf.unknown-boundary', patterns:[/没做过/,/没有经验/,/不会/,/不熟/,/不了解/,/未知/,/怎么验证/] },
] as const;

function resolveQuestionFamily(normalized:string) {
  return FAMILY_RULES.find(rule => rule.patterns.some(pattern => pattern.test(normalized)))?.id ?? null;
}

function rawQuestionText(text:string) {
  return text.normalize('NFKC').trim().replace(/^\s*\d+[\.、]\s*/, '').replace(/\s+/g, ' ');
}

function documentContentHash(input:SourceDocumentInput) {
  if (input.contentHash) return input.contentHash;
  return hash(JSON.stringify({ title:input.title, url:input.canonicalUrl, units:input.units.map(u => [u.locator,u.kind,u.text]) }));
}

export function compileInterviewDocument(db:any, input:SourceDocumentInput) {
  const source:any = db.prepare('SELECT * FROM interview_sources WHERE id=?').get(input.sourceId);
  if (!source) throw new Error(`INTERVIEW_SOURCE_NOT_REGISTERED:${input.sourceId}`);
  const contentHash = documentContentHash(input);
  const documentId = `doc.${shortHash(`${input.sourceId}|${input.canonicalUrl}|${contentHash}`)}`;
  const lifecycle = source.grade === 'C' || source.lifecycle === 'OBSERVATION_ONLY' ? 'OBSERVATION_ONLY' : 'ACTIVE';
  const results:any[] = [];
  db.exec('BEGIN;');
  try {
    db.prepare(`INSERT INTO interview_source_documents(
      id,source_id,title,canonical_url,published_at,captured_at,content_hash,summary,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,published_at=excluded.published_at,
      captured_at=excluded.captured_at,summary=excluded.summary,lifecycle=excluded.lifecycle,updated_at=excluded.updated_at`)
      .run(documentId,input.sourceId,input.title,input.canonicalUrl,input.publishedAt ?? null,input.capturedAt,
        contentHash,null,lifecycle,input.capturedAt,input.capturedAt);

    for (const unit of input.units) {
      const normalized = normalizeQuestionText(unit.text);
      const provenanceKey = `prov.${shortHash(`${input.sourceId}|${input.canonicalUrl}|${unit.locator}|${unit.kind}`)}`;
      const unitId = `unit.${shortHash(provenanceKey)}`;
      db.prepare(`INSERT INTO interview_source_units(
        id,source_document_id,provenance_key,unit_kind,source_locator,summary,normalized_text,lifecycle,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provenance_key) DO UPDATE SET source_document_id=excluded.source_document_id,
        source_locator=excluded.source_locator,summary=excluded.summary,normalized_text=excluded.normalized_text,
        lifecycle=excluded.lifecycle,updated_at=excluded.updated_at`)
        .run(unitId,documentId,provenanceKey,unit.kind,unit.locator,rawQuestionText(unit.text),normalized,lifecycle,input.capturedAt,input.capturedAt);
      if (unit.kind !== 'QUESTION') {
        results.push({ unitId, provenanceKey, status:'SOURCE_ONLY' });
        continue;
      }

      const familyId = resolveQuestionFamily(normalized);
      if (!familyId) {
        results.push({ unitId, provenanceKey, status:'UNCLASSIFIED' });
        continue;
      }

      const questionId = `question.${shortHash(provenanceKey)}`;
      const questionText = rawQuestionText(unit.text);
      db.prepare(`INSERT INTO interview_questions(
        id,question_family_id,source_unit_id,canonical_text,language,difficulty,lifecycle,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,source_unit_id=excluded.source_unit_id,
        canonical_text=excluded.canonical_text,language=excluded.language,difficulty=excluded.difficulty,
        lifecycle=excluded.lifecycle,updated_at=excluded.updated_at`)
        .run(questionId,familyId,unitId,questionText,'zh-CN','UNKNOWN',lifecycle,input.capturedAt,input.capturedAt);

      const signal:any = db.prepare(`SELECT s.id,s.name FROM interview_question_families f
        JOIN interview_signals s ON s.id=f.primary_signal_id WHERE f.id=?`).get(familyId);
      db.prepare('DELETE FROM interview_question_search WHERE item_id=?').run(questionId);
      db.prepare(`INSERT INTO interview_question_search(item_type,item_id,family_id,text,tags,signal_terms)
        VALUES('QUESTION',?,?,?,?,?)`).run(questionId,familyId,questionText,'',`${signal?.id ?? ''} ${signal?.name ?? ''}`);
      results.push({ unitId, provenanceKey, questionId, familyId, signalId:signal?.id ?? null, status:'COMPILED' });
    }

    db.exec('COMMIT;');
    return { sourceId:input.sourceId, documentId, contentHash, units:results };
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  }
}
