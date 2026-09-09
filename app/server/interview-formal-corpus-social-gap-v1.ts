import { registerFormalQuestionCorpusP5B } from './interview-formal-corpus-p5b.ts';
import { registerAuditedInterviewSources, compileInterviewDocument } from './interview-source-compiler.ts';

type FamilySeed={
  id:string; name:string; signalId:string; intent:string; decisionPattern:string;
  sourceId:string; methodKey:string;
};
type QuestionSeed={
  id:string; familyId:string; methodKey:string; text:string;
  difficulty:'SENIOR'|'STAFF'; tags:string; pressure:string;
};
type MethodSeed={key:string;sourceId:string;locator:string;text:string};

const FAMILIES:FamilySeed[]=[
  {id:'qf.agent-skill-lifecycle',name:'Agent Skill Lifecycle & Loading',signalId:'signal.judgment',methodKey:'skill',sourceId:'source.anthropic-agent-skills',intent:'验证 Skill 与 Tool/MCP 边界、发现、渐进加载、执行验证和维护',decisionPattern:'Task Need → Discover Metadata → Progressive Load → Execute → Verify → Update'},
  {id:'qf.agent-multi-agent-orchestration',name:'Multi-Agent Orchestration',signalId:'signal.judgment',methodKey:'multi',sourceId:'source.openai-agents-orchestration',intent:'验证多 Agent 职责、handoff / agent-as-tool、authority 与结果合并',decisionPattern:'Task Decomposition → Ownership → Agent Selection → Delegate → Merge → Recover'},
  {id:'qf.agent-memory-strategy',name:'Agent Memory Strategy',signalId:'signal.judgment',methodKey:'memory',sourceId:'source.openai-agents-sessions',intent:'验证会话历史、工作状态与长期记忆的边界、写入和召回策略',decisionPattern:'State Type → Retention → Write Policy → Retrieve → Conflict/Decay → Audit'},
  {id:'qf.prompt-engineering-eval',name:'Prompt Engineering & Eval',signalId:'signal.judgment',methodKey:'prompt',sourceId:'source.anthropic-prompting',intent:'验证 Prompt 约束、示例、结构和可回归评测，而不是背提示词技巧',decisionPattern:'Task/Constraint → Prompt Structure → Examples/Contract → Eval Cases → Iterate/Version'},
];
const QUESTIONS:QuestionSeed[]=[
  {id:'fq7.agent-skill.01',familyId:'qf.agent-skill-lifecycle',methodKey:'skill',difficulty:'SENIOR',tags:'agent skill progressive disclosure metadata discover load instructions skill vs tool mcp',text:'Agent 已经能调用 Tool / MCP，为什么还需要 Skill？你会怎样设计 Skill 的发现、按需加载和执行边界？',pressure:'如果把所有 Skill 正文都提前塞进 system prompt，为什么可能反而让 Agent 更不稳定？'},
  {id:'fq7.agent-skill.02',familyId:'qf.agent-skill-lifecycle',methodKey:'skill',difficulty:'SENIOR',tags:'skill lifecycle version update verify instructions scripts resources context',text:'一个团队 Skill 从“个人经验”变成可复用资产时，你会怎样处理说明、脚本、依赖、验证和版本更新？',pressure:'Skill 能正常被模型加载，为什么还不能证明它的执行结果是可靠的？'},
  {id:'fq7.multi-agent.01',familyId:'qf.agent-multi-agent-orchestration',methodKey:'multi',difficulty:'STAFF',tags:'multi agent multiagent orchestration agents as tools handoff manager specialist ownership final answer',text:'什么时候应该让一个 Manager Agent 把子 Agent 当 Tool 调用，什么时候应该直接 Handoff 给 Specialist？',pressure:'如果两个模式都能完成任务，最终回答 ownership、上下文边界和 guardrail 会怎样影响选择？'},
  {id:'fq7.multi-agent.02',familyId:'qf.agent-multi-agent-orchestration',methodKey:'multi',difficulty:'STAFF',tags:'multi agent decomposition authority context merge conflict recovery coordination',text:'多 Agent 并行处理同一复杂任务时，你怎样划分职责、上下文和 authority，并处理结果冲突或部分失败？',pressure:'子 Agent 越多为什么不一定越快、越准？你会用什么停止或降级条件？'},
  {id:'fq7.memory.01',familyId:'qf.agent-memory-strategy',methodKey:'memory',difficulty:'SENIOR',tags:'agent memory session working memory long term memory conversation state retention retrieval',text:'Agent 的 Session 历史、工作状态和长期记忆分别应该保存什么？你如何决定哪些信息进入下一轮上下文？',pressure:'把所有历史消息都永久保存并每轮回填，为什么不是一个可靠的 Memory 方案？'},
  {id:'fq7.memory.02',familyId:'qf.agent-memory-strategy',methodKey:'memory',difficulty:'STAFF',tags:'memory write policy retrieval stale conflict decay audit retention privacy',text:'设计长期 Memory 时，你会怎样定义写入、召回、过期、冲突和审计策略，避免旧信息持续污染 Agent 决策？',pressure:'模型说“记住了”为什么不能等价于系统已经形成可恢复、可审计的长期记忆？'},
  {id:'fq7.prompt.01',familyId:'qf.prompt-engineering-eval',methodKey:'prompt',difficulty:'SENIOR',tags:'prompt engineering clear constraints examples structure output contract evaluation iterate',text:'一个 Prompt 输出不稳定时，你如何从任务目标、约束、上下文、示例和输出契约逐层定位，而不是反复凭感觉改词？',pressure:'加更多更长的指令为什么可能让结果更差？你怎样证明某次 Prompt 修改真的有效？'},
  {id:'fq7.prompt.02',familyId:'qf.prompt-engineering-eval',methodKey:'prompt',difficulty:'STAFF',tags:'prompt version regression eval cases few shot edge cases model migration prompt engineering',text:'Prompt 要长期上线维护时，你会怎样建立版本、评测集和回归 Gate，使模型升级或业务变化不会悄悄破坏效果？',pressure:'如果十个示例都变好但真实线上 bad case 变多，你会怎样判断是否回滚？'},
];
const METHODS:MethodSeed[]=[
  {key:'skill',sourceId:'source.anthropic-agent-skills',locator:'social-gap-v1/skill',text:'Agent Skills 用可发现的元数据和按需加载的说明、脚本与资源封装程序性知识；渐进式披露减少无关上下文，同时执行结果仍需要真实工具与验证链。'},
  {key:'multi',sourceId:'source.openai-agents-orchestration',locator:'social-gap-v1/multi-agent',text:'多 Agent 编排可使用 agents-as-tools 让 manager 保持最终回答 ownership，也可 handoff 让 specialist 接管当前 turn；两种模式需要根据职责、上下文和控制边界选择。'},
  {key:'memory',sourceId:'source.openai-agents-sessions',locator:'social-gap-v1/memory',text:'Agent state 可由应用输入、持久 Session 或服务端 conversation 等不同策略承载；应明确单次运行状态、跨 turn 会话历史与长期记忆的 ownership，避免重复上下文和不可恢复状态。'},
  {key:'prompt',sourceId:'source.anthropic-prompting',locator:'social-gap-v1/prompt',text:'稳定 Prompt 应明确目标、约束和输出，提供相关且多样的示例并结构化复杂上下文；Prompt 改动应通过代表性 case 和回归评测验证，而不是只凭单次输出判断。'},
];

function registerMethodUnits(db:any,now:string){
  registerAuditedInterviewSources(db,now);
  const units=new Map<string,string>();
  for(const method of METHODS){
    const source:any=db.prepare('SELECT canonical_url,name FROM interview_sources WHERE id=?').get(method.sourceId);
    if(!source) throw new Error(`SG1_SOURCE_MISSING:${method.sourceId}`);
    const compiled:any=compileInterviewDocument(db,{sourceId:method.sourceId,title:`Social Gap V1｜${source.name}`,canonicalUrl:source.canonical_url,capturedAt:now,units:[{locator:method.locator,kind:'TECHNIQUE',text:method.text}]});
    const unit=compiled.units[0]; if(!unit?.unitId) throw new Error(`SG1_SOURCE_UNIT_MISSING:${method.key}`);
    units.set(method.key,unit.unitId);
  }
  return units;
}
export function registerFormalQuestionCorpusSocialGapV1(db:any,now=new Date().toISOString()){
  registerFormalQuestionCorpusP5B(db,now);
  const methodUnits=registerMethodUnits(db,now);
  db.exec('BEGIN;');
  try{
    const family=db.prepare(`INSERT INTO interview_question_families(id,name,primary_signal_id,normalized_intent,decision_pattern,lifecycle,version,created_at,updated_at)
      VALUES(?,?,?,?,?,'ACTIVE',1,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,primary_signal_id=excluded.primary_signal_id,normalized_intent=excluded.normalized_intent,decision_pattern=excluded.decision_pattern,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of FAMILIES) family.run(row.id,row.name,row.signalId,row.intent,row.decisionPattern,now,now);
    const question=db.prepare(`INSERT INTO interview_questions(id,question_family_id,source_unit_id,canonical_text,language,difficulty,lifecycle,created_at,updated_at)
      VALUES(?,?,?,?,'zh-CN',?,'ACTIVE',?,?)
      ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,source_unit_id=excluded.source_unit_id,canonical_text=excluded.canonical_text,difficulty=excluded.difficulty,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const variant=db.prepare(`INSERT INTO interview_question_variants(id,question_id,source_unit_id,text,tone,pressure_mode,language,lifecycle,created_at,updated_at)
      VALUES(?,?,?,?,'DIRECT','PRESSURE','zh-CN','ACTIVE',?,?)
      ON CONFLICT(id) DO UPDATE SET source_unit_id=excluded.source_unit_id,text=excluded.text,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const search=db.prepare(`INSERT INTO interview_question_search(item_type,item_id,family_id,text,tags,signal_terms) VALUES('QUESTION',?,?,?,?,?)`);
    for(const row of QUESTIONS){
      const unitId=methodUnits.get(row.methodKey); if(!unitId) throw new Error(`SG1_METHOD_NOT_FOUND:${row.methodKey}`);
      question.run(row.id,row.familyId,unitId,row.text,row.difficulty,now,now);
      variant.run(`fq7v.${row.id.slice(4)}`,row.id,unitId,row.pressure,now,now);
      const signal:any=db.prepare(`SELECT s.id,s.name FROM interview_question_families f LEFT JOIN interview_signals s ON s.id=f.primary_signal_id WHERE f.id=?`).get(row.familyId);
      db.prepare("DELETE FROM interview_question_search WHERE item_type='QUESTION' AND item_id=?").run(row.id);
      search.run(row.id,row.familyId,`${row.text} ${row.pressure}`,row.tags,`${signal?.id??''} ${signal?.name??''}`);
    }
    const anchor=db.prepare(`INSERT INTO interview_scoring_anchors(id,question_family_id,signal_id,source_unit_id,polarity,observable_behavior,lifecycle,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'ACTIVE',?,?)
      ON CONFLICT(id) DO UPDATE SET source_unit_id=excluded.source_unit_id,polarity=excluded.polarity,observable_behavior=excluded.observable_behavior,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of FAMILIES){
      const unitId=methodUnits.get(row.methodKey); if(!unitId) throw new Error(`SG1_ANCHOR_METHOD_NOT_FOUND:${row.methodKey}`);
      anchor.run(`anchor.fq7.${row.id.slice(3)}.positive`,row.id,row.signalId,unitId,'POSITIVE',`能围绕 ${row.name} 解释机制、边界、失败路径，并给出可验证的工程判断。`,now,now);
      anchor.run(`anchor.fq7.${row.id.slice(3)}.negative`,row.id,row.signalId,unitId,'NEGATIVE',`只背 ${row.name} 名词或框架用法，无法说明 trade-off、状态 ownership 与验证方法。`,now,now);
    }
    db.exec('COMMIT;');
    return {families:FAMILIES.length,questions:QUESTIONS.length,variants:QUESTIONS.length,anchors:FAMILIES.length*2,methodUnits:methodUnits.size};
  }catch(error){
    try{db.exec('ROLLBACK;')}catch{}
    throw error;
  }
}