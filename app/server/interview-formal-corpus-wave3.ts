import { registerFormalQuestionCorpusWave2 } from './interview-formal-corpus-wave2.ts';
import { registerPublicCorpusWave, type PublicAnchorSeed } from './interview-corpus-utils.ts';

const FAMILIES=[
  {id:'qf.coding-debugging-strategy',name:'Coding & Debugging Strategy',signalId:'signal.baseline',intent:'验证陌生代码、调试、实现与验证基本功',decisionPattern:'Reproduce → Localize → Minimal Change → Test → Verify'},
  {id:'qf.jd-role-fit-mapping',name:'JD Role Fit Mapping',signalId:'signal.transferability',intent:'验证如何把岗位要求映射到强证据、可迁移能力和真实缺口',decisionPattern:'Requirement → Evidence Tier → Transfer → Gap → Boundary'},
  {id:'qf.fde-case-response',name:'FDE Case Response',signalId:'signal.judgment',intent:'验证客户现场的澄清、排查、方案与交付决策',decisionPattern:'Symptom → Facts → Hypotheses → Action → Validation → Handoff'},
  {id:'qf.claim-risk-boundary',name:'Claim Risk Boundary',signalId:'signal.truthfulness',intent:'验证主导、价值、范围与未知被追问时是否守住事实边界',decisionPattern:'Claim → Scope → Personal Action → Evidence → Qualifier'},
  {id:'qf.candidate-due-diligence',name:'Candidate Due Diligence',signalId:'signal.risk',intent:'验证候选人如何反向判断岗位、团队、成功标准和组织风险',decisionPattern:'Question → Signal → Risk → Follow-up → Decision'},
  {id:'qf.offer-negotiation',name:'Offer Negotiation',signalId:'signal.judgment',intent:'验证 Offer 信息收集、BATNA、目标与多变量谈判判断',decisionPattern:'Information → BATNA → Target/Reservation → Trade → Written Verify'},
] as const;

const QUESTIONS=[
  {id:'fq3.coding.01',familyId:'qf.coding-debugging-strategy',difficulty:'SENIOR',tags:'coding debugging unfamiliar repo production bug',text:'你接手一个陌生代码库里的线上 bug，会怎样从复现走到最小修复和验证？',pressure:'如果日志不完整、测试覆盖也不好，如何避免边看边猜、一次改很多东西？'},
  {id:'fq3.coding.02',familyId:'qf.coding-debugging-strategy',difficulty:'SENIOR',tags:'coding spike tdd validation implementation',text:'实现一个不确定性很高的功能时，你什么时候先做 spike，什么时候直接进入 TDD？',pressure:'如果 spike 已经跑通，为什么不能直接把实验代码当正式实现？'},
  {id:'fq3.jd-fit.01',familyId:'qf.jd-role-fit-mapping',difficulty:'SENIOR',tags:'jd role fit agent node frontend evidence transfer gap',text:'一个 JD 同时要求 Agent、Node 和前端平台能力，你怎么区分强证据、可迁移能力和真实缺口？',pressure:'哪些内容可以主动映射，哪些必须明确说没有直接做过？'},
  {id:'fq3.jd-fit.02',familyId:'qf.jd-role-fit-mapping',difficulty:'SENIOR',tags:'jd requirement evidence boundary resume',text:'面试官追问一个简历里没明确写过的能力，你会怎样把已有经验映射过去而不夸大？',pressure:'如果只是懂原理但没有生产经验，回答结构应该怎么变？'},
  {id:'fq3.fde-case.01',familyId:'qf.fde-case-response',difficulty:'SENIOR',tags:'fde case customer incident incomplete logs diagnosis',text:'客户现场反馈页面很慢且偶发报错，但日志不完整，你会怎么组织前 30 分钟排查？',pressure:'如何同时管理技术假设、客户沟通和先别扩大事故的止损动作？'},
  {id:'fq3.fde-case.02',familyId:'qf.fde-case-response',difficulty:'STAFF',tags:'fde case deadline requirement control plane risk',text:'临上线前客户提出一个关键需求，但当前方案可能破坏控制面边界，你会怎么决策？',pressure:'如果销售和客户都要求先上线再说，你的停止条件是什么？'},
  {id:'fq3.claim-risk.01',familyId:'qf.claim-risk-boundary',difficulty:'SENIOR',tags:'claim ownership scope resume boundary',text:'面试官抓住简历里的“主导”两个字，要求说清团队、本人、决策和实现范围，你怎么回答？',pressure:'如果推动了方案但不是仓库创建者，也不是所有文件作者，如何既不缩小贡献也不冒领？'},
  {id:'fq3.claim-risk.02',familyId:'qf.claim-risk-boundary',difficulty:'SENIOR',tags:'claim roi metrics value truthfulness',text:'面试官要求给出提效百分比或 ROI，但你只有工程证据、没有可靠 KPI，你会怎么回答？',pressure:'如果对方坚持要数字，你会给哪些代理指标、拒绝哪些推断？'},
  {id:'fq3.due-diligence.01',familyId:'qf.candidate-due-diligence',difficulty:'STANDARD',tags:'candidate due diligence reverse interview success criteria',text:'面试最后只能问三个问题，你会怎样判断岗位真实职责、成功标准和决策空间？',pressure:'什么样的回答会让你继续追问，而不是把“团队氛围很好”当有效信息？'},
  {id:'fq3.due-diligence.02',familyId:'qf.candidate-due-diligence',difficulty:'SENIOR',tags:'candidate due diligence hiring risk team process',text:'你如何识别招聘描述和真实工作可能不一致，哪些信号会提高岗位风险判断？',pressure:'如果面试官回答互相矛盾，如何在不冒犯的前提下继续补证据？'},
  {id:'fq3.negotiation.01',familyId:'qf.offer-negotiation',difficulty:'STANDARD',tags:'offer negotiation batna total compensation information',text:'拿到 Offer 后，你会先谈薪，还是先补齐岗位、级别、总包和入职条件信息？为什么？',pressure:'如果对方要求立刻给期望薪资，你会先确认哪些变量？'},
  {id:'fq3.negotiation.02',familyId:'qf.offer-negotiation',difficulty:'SENIOR',tags:'offer negotiation reservation target batna',text:'对方问最低可接受薪资，你如何使用 BATNA、Target 和 Reservation Point，而不仓促报出底线？',pressure:'如果基本薪资空间有限，如何转向级别、奖金、股票、假期或入职时间等变量？'},
] as const;

const LINKS=[
  {id:'link.fq3.jd.ai',familyId:'qf.jd-role-fit-mapping',evidenceRefId:'ev.demo.context-engineering',boundaryId:'cb.demo.context-engineering',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq3.jd.fde',familyId:'qf.jd-role-fit-mapping',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.fq3.jd.fe',familyId:'qf.jd-role-fit-mapping',evidenceRefId:'ev.demo.platform-migration',boundaryId:'cb.demo.platform-migration',routeId:'route.advanced-fe-fullstack',strength:'STRONG'},
  {id:'link.fq3.fde-case.fde',familyId:'qf.fde-case-response',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.fq3.claim.ai',familyId:'qf.claim-risk-boundary',evidenceRefId:'ev.demo.devtools-ownership',boundaryId:'cb.demo.devtools-ownership',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq3.claim.fde',familyId:'qf.claim-risk-boundary',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.fq3.claim.fe',familyId:'qf.claim-risk-boundary',evidenceRefId:'ev.demo.fullstack-runtime',boundaryId:'cb.demo.fullstack-runtime',routeId:'route.advanced-fe-fullstack',strength:'MEDIUM'},
] as const;

const METHODS=[
  {key:'coding',sourceId:'source.tech-interview-handbook',locator:'public-wave3/coding',kind:'TECHNIQUE',text:'Coding 面试应观察问题澄清、分解、实现、测试与调试过程。'},
  {key:'jd',sourceId:'source.feishu-hire',locator:'public-wave3/role-fit',kind:'RUBRIC',text:'岗位评价应区分直接经验、可迁移能力和未验证缺口。'},
  {key:'fde',sourceId:'source.system-design-primer',locator:'public-wave3/fde-case',kind:'TECHNIQUE',text:'开放式 Case 应先澄清目标、约束与可观察事实，再逐步验证假设。'},
  {key:'claim',sourceId:'source.eng-rubrics',locator:'public-wave3/claim',kind:'RUBRIC',text:'评分应区分团队背景、个人行为、可观察结果和无法归因部分。'},
  {key:'due',sourceId:'source.reverse-interview',locator:'public-wave3/due-diligence',kind:'TECHNIQUE',text:'候选人反问应帮助判断职责、团队流程、成功标准和组织风险。'},
  {key:'neg',sourceId:'source.harvard-pon',locator:'public-wave3/negotiation',kind:'NEGOTIATION',text:'谈判前应先建立 BATNA、目标、保留点和信息边界，再处理锚点与交换。'},
] as const;
const METHOD_BY_FAMILY={
  'qf.coding-debugging-strategy':'coding','qf.jd-role-fit-mapping':'jd','qf.fde-case-response':'fde',
  'qf.claim-risk-boundary':'claim','qf.candidate-due-diligence':'due','qf.offer-negotiation':'neg',
} as const;
const ANCHORS:PublicAnchorSeed[]=FAMILIES.flatMap((row)=>[
  {id:`anchor.fq3.${row.id.slice(3)}.positive`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'POSITIVE',behavior:`能围绕 ${row.name} 给出事实、边界、判断和验证。`},
  {id:`anchor.fq3.${row.id.slice(3)}.negative`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'NEGATIVE',behavior:`在 ${row.name} 中混淆事实与推断，或缺少可验证边界。`},
]);
const EDGES=[
  ['edge.fq3.coding.follow','qf.coding-debugging-strategy','qf.failure-tradeoff','FOLLOW_UP',80],
  ['edge.fq3.jd.challenge','qf.jd-role-fit-mapping','qf.claim-risk-boundary','CHALLENGE',90],
  ['edge.fq3.fde.follow','qf.fde-case-response','qf.fde-risk-control','FOLLOW_UP',90],
  ['edge.fq3.claim.clarify','qf.claim-risk-boundary','qf.unknown-boundary','CLARIFY',85],
  ['edge.fq3.due.follow','qf.candidate-due-diligence','qf.offer-negotiation','FOLLOW_UP',70],
] as const;

export function registerFormalQuestionCorpusWave3(db:any,now=new Date().toISOString()){
  registerFormalQuestionCorpusWave2(db,now);
  return registerPublicCorpusWave(db,{
    wave:'Public Formal Corpus Wave 3',variantPrefix:'fq3v',
    families:[...FAMILIES],questions:[...QUESTIONS],links:[...LINKS],methods:[...METHODS],anchors:ANCHORS,edges:[...EDGES],
  },now);
}
