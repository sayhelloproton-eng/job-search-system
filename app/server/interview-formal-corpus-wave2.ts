import { registerFormalQuestionCorpusWave1 } from './interview-formal-corpus.ts';
import { registerPublicCorpusWave, type PublicAnchorSeed } from './interview-corpus-utils.ts';

const FAMILIES=[
  {id:'qf.observability-truth',name:'Observability Truth Boundary',signalId:'signal.risk',intent:'验证观测系统的事实边界、可靠性与隐私判断',decisionPattern:'Fact Source → Evidence → Sanitization → Delivery → Recovery'},
  {id:'qf.negative-eval-decision',name:'Negative Evaluation Decision',signalId:'signal.truthfulness',intent:'验证负面评测出现后是否能诚实重定义问题并决定继续或停止',decisionPattern:'Hypothesis → Eval → Negative Result → Reframe → Continue/Stop'},
  {id:'qf.architecture-restart-judgment',name:'Architecture Restart Judgment',signalId:'signal.judgment',intent:'验证架构已能运行时是否能识别错误 ownership 并推翻沉没成本',decisionPattern:'Working System → Reality Failure → Semantic Inventory → Rewrite Decision'},
  {id:'qf.behavior-ownership-continuity',name:'Behavior Ownership Continuity',signalId:'signal.ownership',intent:'验证长期 Ownership、协作边界与不完整信息下的行为一致性',decisionPattern:'Long-term Scope → Personal Change Surface → Collaboration → Boundary'},
  {id:'qf.value-evidence',name:'Value Without Fake Metrics',signalId:'signal.value',intent:'验证没有完美 KPI 时如何用真实 Evidence 证明价值而不制造 ROI',decisionPattern:'Work → Engineering Change → Delivery/System Result → Value Boundary'},
  {id:'qf.platform-system-design',name:'Platform System Design',signalId:'signal.ceiling',intent:'验证平台系统设计中的边界、Authority、失败路径与演进',decisionPattern:'Goal → Quality Attribute → Boundary → Authority/Data → Failure → Evolution'},
] as const;

const QUESTIONS=[
  {id:'fq2.observability.01',familyId:'qf.observability-truth',difficulty:'SENIOR',tags:'route.ai-agent-devtools observability truth privacy fail-open',text:'AI 使用观测系统本身失败时，为什么不能反过来阻塞用户主任务？',pressure:'如果又要求可靠上报，fail-open 和可靠补偿怎么同时成立？'},
  {id:'fq2.observability.02',familyId:'qf.observability-truth',difficulty:'STAFF',tags:'route.ai-agent-devtools metrics evidence inference privacy',text:'如何区分观测事实、确定性指标和 AI 推断，避免把使用数据直接包装成提效结论？',pressure:'如果业务方坚持要一个“提效百分比”，你会给什么、拒绝什么？'},
  {id:'fq2.negative-eval.01',familyId:'qf.negative-eval-decision',difficulty:'SENIOR',tags:'route.ai-agent-devtools negative eval decision',text:'一个方案的 A/B 没有稳定证明耗时或资源下降，你为什么还可能继续推进？',pressure:'怎样证明你不是因为沉没成本而给失败实验换指标？'},
  {id:'fq2.negative-eval.02',familyId:'qf.negative-eval-decision',difficulty:'SENIOR',tags:'route.ai-agent-devtools experiment stop continue truthfulness',text:'技术实验出现负面结果后，你用什么标准决定停止、重做还是保留其中一部分？',pressure:'请区分“核心假设失败”和“评价指标选错”。'},
  {id:'fq2.arch-restart.01',familyId:'qf.architecture-restart-judgment',difficulty:'STAFF',tags:'route.ai-agent-devtools architecture restart ownership sunk cost',text:'一个架构已经能跑了，什么证据会让你决定 Architecture Restart 而不是继续修？',pressure:'如何避免“重写一切”只是技术洁癖？'},
  {id:'fq2.arch-restart.02',familyId:'qf.architecture-restart-judgment',difficulty:'STAFF',tags:'route.ai-agent-devtools prototype semantic migration rewrite',text:'从 Prototype 重写正式系统时，哪些东西应该迁移，哪些实现应该直接删除？',pressure:'实验代码投入很多时，怎样判断真正资产是代码还是被验证的语义？'},
  {id:'fq2.behavior-ownership.01',familyId:'qf.behavior-ownership-continuity',difficulty:'SENIOR',tags:'route.tob-fde route.advanced-fe-fullstack ownership maintenance',text:'一个共享能力维护了很多年，你如何证明这是长期 Ownership，而不是一直在接零散需求？',pressure:'请区分团队长期负责、个人 change surface 和真正由你做的判断。'},
  {id:'fq2.behavior-ownership.02',familyId:'qf.behavior-ownership-continuity',difficulty:'SENIOR',tags:'route.tob-fde route.advanced-fe-fullstack collaboration incident boundary',text:'线上问题没有完整 RCA、又涉及多个团队时，你如何推进问题而不越界冒领？',pressure:'如果最终根因不在你负责的层，你的 Ownership 还体现在哪里？'},
  {id:'fq2.value.01',familyId:'qf.value-evidence',difficulty:'SENIOR',tags:'route.tob-fde route.advanced-fe-fullstack value evidence',text:'没有直接收入或效率 KPI 时，你怎么证明一项平台工程工作的业务价值？',pressure:'哪些结果可以安全说，哪些不能因为听起来更有价值就换算成 ROI？'},
  {id:'fq2.value.02',familyId:'qf.value-evidence',difficulty:'SENIOR',tags:'route.tob-fde route.advanced-fe-fullstack delivery ownership value',text:'参与多个 ToB 交付时，怎么把团队交付结果和个人创造的价值分开讲？',pressure:'如果客户价值真实存在，但没有个人归因数字，你会怎么回答？'},
  {id:'fq2.system-design.01',familyId:'qf.platform-system-design',difficulty:'STAFF',tags:'route.tob-fde route.advanced-fe-fullstack platform system design control plane authority',text:'设计一个同时服务用户和管理员的控制面平台时，你先怎么划分边界、Authority 和共享能力？',pressure:'哪些状态必须有单一事实源，哪些能力可以复用，哪些差异不能强行统一？'},
  {id:'fq2.system-design.02',familyId:'qf.platform-system-design',difficulty:'STAFF',tags:'route.tob-fde route.advanced-fe-fullstack monitoring platform system design evolution',text:'一个共享观测能力要支持多个产品、历史数据和持续演进，你会怎么设计兼容与失败路径？',pressure:'复用范围越来越大时，怎样控制 blast radius？'},
] as const;

const LINKS=[
  {id:'link.fq2.obs.ai',familyId:'qf.observability-truth',evidenceRefId:'ev.demo.usage-observability',boundaryId:'cb.demo.usage-observability',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq2.obs.fde',familyId:'qf.observability-truth',evidenceRefId:'ev.demo.usage-observability',boundaryId:'cb.demo.usage-observability',routeId:'route.tob-fde',strength:'MEDIUM'},
  {id:'link.fq2.neg.ai',familyId:'qf.negative-eval-decision',evidenceRefId:'ev.demo.registry-governance',boundaryId:'cb.demo.registry-governance',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq2.arch.ai',familyId:'qf.architecture-restart-judgment',evidenceRefId:'ev.demo.architecture-restart',boundaryId:'cb.demo.architecture-restart',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq2.beh.fde',familyId:'qf.behavior-ownership-continuity',evidenceRefId:'ev.demo.platform-observability',boundaryId:'cb.demo.platform-observability',routeId:'route.tob-fde',strength:'MEDIUM'},
  {id:'link.fq2.beh.fe',familyId:'qf.behavior-ownership-continuity',evidenceRefId:'ev.demo.platform-observability',boundaryId:'cb.demo.platform-observability',routeId:'route.advanced-fe-fullstack',strength:'STRONG'},
  {id:'link.fq2.value.fde',familyId:'qf.value-evidence',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.fq2.value.fe',familyId:'qf.value-evidence',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.advanced-fe-fullstack',strength:'MEDIUM'},
  {id:'link.fq2.design.fde',familyId:'qf.platform-system-design',evidenceRefId:'ev.demo.platform-observability',boundaryId:'cb.demo.platform-observability',routeId:'route.tob-fde',strength:'MEDIUM'},
  {id:'link.fq2.design.fe',familyId:'qf.platform-system-design',evidenceRefId:'ev.demo.platform-observability',boundaryId:'cb.demo.platform-observability',routeId:'route.advanced-fe-fullstack',strength:'STRONG'},
] as const;

const METHODS=[
  {key:'obs',sourceId:'source.karat',locator:'public-wave2/observability',kind:'RUBRIC',text:'评价应观察证据收集、验证和调试行为，而不是把模型输出或单一指标当事实。'},
  {key:'neg',sourceId:'source.staffeng',locator:'public-wave2/negative-result',kind:'RUBRIC',text:'资深判断包含面对负面结果时修正假设、解释 trade-off 和停止无效投入。'},
  {key:'arch',sourceId:'source.staffeng',locator:'public-wave2/architecture',kind:'RUBRIC',text:'Staff+ 面试应验证跨边界判断、长期影响和何时改变已有架构。'},
  {key:'beh',sourceId:'source.feishu-hire',locator:'public-wave2/behavior',kind:'RUBRIC',text:'行为问题应区分团队背景、个人行为和可观察结果。'},
  {key:'value',sourceId:'source.eng-rubrics',locator:'public-wave2/value',kind:'RUBRIC',text:'评分应区分直接证据、合理推断和无法归因的团队结果。'},
  {key:'design',sourceId:'source.system-design-primer',locator:'public-wave2/system-design',kind:'TECHNIQUE',text:'系统设计从需求与质量属性开始，显式讨论边界、数据、失败模式和演进。'},
] as const;

const METHOD_BY_FAMILY={
  'qf.observability-truth':'obs','qf.negative-eval-decision':'neg','qf.architecture-restart-judgment':'arch',
  'qf.behavior-ownership-continuity':'beh','qf.value-evidence':'value','qf.platform-system-design':'design',
} as const;
const ANCHORS:PublicAnchorSeed[]=FAMILIES.flatMap((row)=>[
  {id:`anchor.fq2.${row.id.slice(3)}.positive`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'POSITIVE',behavior:`能用可观察证据解释 ${row.name} 的判断、边界与 trade-off。`},
  {id:`anchor.fq2.${row.id.slice(3)}.negative`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'NEGATIVE',behavior:`用模糊结果或虚构指标替代 ${row.name} 的证据。`},
]);
const EDGES=[
  ['edge.fq2.obs.clarify','qf.observability-truth','qf.unknown-boundary','CLARIFY',80],
  ['edge.fq2.neg.follow','qf.negative-eval-decision','qf.failure-tradeoff','FOLLOW_UP',85],
  ['edge.fq2.arch.follow','qf.architecture-restart-judgment','qf.failure-tradeoff','FOLLOW_UP',90],
  ['edge.fq2.beh.follow','qf.behavior-ownership-continuity','qf.value-evidence','FOLLOW_UP',85],
  ['edge.fq2.value.challenge','qf.value-evidence','qf.ownership','CHALLENGE',80],
] as const;

export function registerFormalQuestionCorpusWave2(db:any,now=new Date().toISOString()){
  registerFormalQuestionCorpusWave1(db,now);
  return registerPublicCorpusWave(db,{
    wave:'Public Formal Corpus Wave 2',variantPrefix:'fq2v',
    families:[...FAMILIES],questions:[...QUESTIONS],links:[...LINKS],methods:[...METHODS],anchors:ANCHORS,edges:[...EDGES],
  },now);
}
