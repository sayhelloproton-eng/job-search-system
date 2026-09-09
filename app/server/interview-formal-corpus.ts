import { registerCandidateInterviewEvidence } from './interview-candidate-evidence.ts';
import { registerPublicCorpusWave, type PublicAnchorSeed } from './interview-corpus-utils.ts';

const FAMILIES=[
  {id:'qf.agent-runtime-recovery',name:'Agent Runtime Recovery',signalId:'signal.ceiling',intent:'验证外部副作用、恢复、幂等与现实证据判断',decisionPattern:'Reality → Effect Boundary → Reconcile → Retry Decision'},
  {id:'qf.context-access-strategy',name:'Context Access Strategy',signalId:'signal.judgment',intent:'验证大仓信息访问策略与 Context Engineering 判断',decisionPattern:'Bottleneck → Access Layer → Guard → Targeted Source'},
  {id:'qf.fde-requirement-decomposition',name:'FDE Requirement Decomposition',signalId:'signal.transferability',intent:'验证客户模糊需求的澄清、拆解与交付映射',decisionPattern:'Ambiguity → Actors → Constraints → Capability Map → Verification'},
  {id:'qf.fde-risk-control',name:'FDE Risk Control',signalId:'signal.risk',intent:'验证高风险操作和不完整信息下的风险控制',decisionPattern:'Risk → Guardrail → Approval → Verification → Residual Risk'},
  {id:'qf.frontend-platform-migration',name:'Frontend Platform Migration',signalId:'signal.scope',intent:'验证共享事实变化、跨仓 blast radius 与迁移治理',decisionPattern:'Shared Fact → Dependency Inventory → Order → Compatibility → Closeout'},
  {id:'qf.fullstack-boundary',name:'Frontend Fullstack Boundary',signalId:'signal.transferability',intent:'验证前端、Node、发布和可观测性之间的责任边界',decisionPattern:'Symptom → Layer Ownership → Evidence → Fix Location → Verification'},
] as const;

const QUESTIONS=[
  {id:'fq1.agent-runtime.01',familyId:'qf.agent-runtime-recovery',difficulty:'SENIOR',tags:'route.ai-agent-devtools agent runtime recovery idempotency',text:'一个外部副作用请求超时了，你如何判断现在能不能安全重试？',pressure:'你只能看到客户端超时，不能确认现实动作有没有发生；请给出判断顺序。'},
  {id:'fq1.agent-runtime.02',familyId:'qf.agent-runtime-recovery',difficulty:'STAFF',tags:'route.ai-agent-devtools reality unknown recovery',text:'外部操作可能已经发生但响应丢失时，你会怎样设计恢复与 UNKNOWN 边界？',pressure:'如果这个操作没有可靠 postcondition，你还会自动重放吗？为什么？'},
  {id:'fq1.context.01',familyId:'qf.context-access-strategy',difficulty:'SENIOR',tags:'route.ai-agent-devtools context large repo access strategy',text:'大仓里的 Coding Agent context 不够时，你会先扩大窗口、上 RAG，还是改源码访问策略？为什么？',pressure:'如果更大的窗口和 RAG 都能用，为什么还需要访问协议和 Runtime Guard？'},
  {id:'fq1.context.02',familyId:'qf.context-access-strategy',difficulty:'SENIOR',tags:'route.ai-agent-devtools context graph targeted source guard',text:'如何让 Coding Agent 既不全仓乱扫，又能在必要时下钻到原始源码？',pressure:'Guard 如果只会阻止读取，会不会反而让 Agent 失去解决复杂问题的能力？'},
  {id:'fq1.fde-requirement.01',familyId:'qf.fde-requirement-decomposition',difficulty:'SENIOR',tags:'route.tob-fde requirement decomposition',text:'客户只说“把现有能力迁到隔离环境”，你第一轮会怎么拆需求？',pressure:'如果客户自己也说不清差异，你如何区分事实、假设和待验证项？'},
  {id:'fq1.fde-requirement.02',familyId:'qf.fde-requirement-decomposition',difficulty:'SENIOR',tags:'route.tob-fde dual control plane tenant admin',text:'同一产品要同时面向用户和管理员两套控制面，你如何划分共性与差异？',pressure:'哪些差异应该配置化，哪些必须保留独立 ownership？'},
  {id:'fq1.fde-risk.01',familyId:'qf.fde-risk-control',difficulty:'SENIOR',tags:'route.tob-fde risk guardrail approval verification',text:'客户现场一个高风险运维动作要上线，你会怎样设计防错、审批和验收？',pressure:'如果操作不可逆，你会把哪些 precondition 放到真正 effect boundary 前再次验证？'},
  {id:'fq1.fde-risk.02',familyId:'qf.fde-risk-control',difficulty:'SENIOR',tags:'route.tob-fde unknown deadline residual risk',text:'需求信息不完整但交付时间固定时，你如何标记未知并继续推进？',pressure:'什么时候应该继续带风险交付，什么时候必须停下来补证据？'},
  {id:'fq1.frontend-migration.01',familyId:'qf.frontend-platform-migration',difficulty:'SENIOR',tags:'route.advanced-fe-fullstack cross repo migration blast radius',text:'共享平台事实变更影响多个仓和公共层时，你如何确定 blast radius 和迁移顺序？',pressure:'如果公共组件还存在循环依赖，你会怎样控制迁移切面和回滚风险？'},
  {id:'fq1.frontend-migration.02',familyId:'qf.frontend-platform-migration',difficulty:'SENIOR',tags:'route.advanced-fe-fullstack decommission dependency inventory',text:'下线一个旧系统时，为什么“隐藏入口”不等于迁移完成？你会怎样做依赖和入口清单？',pressure:'如果仍有业务仓直接跳旧路由，你如何证明退场真正闭环？'},
  {id:'fq1.fullstack-boundary.01',familyId:'qf.fullstack-boundary',difficulty:'STANDARD',tags:'route.advanced-fe-fullstack ssr node release monitoring boundary',text:'SSR/Node 链路出现故障时，你如何划分浏览器、Node 服务、发布和监控的责任边界？',pressure:'没有完整后端主责经验时，如何证明能定位跨层问题而不越界冒领？'},
  {id:'fq1.fullstack-boundary.02',familyId:'qf.fullstack-boundary',difficulty:'SENIOR',tags:'route.advanced-fe-fullstack frontend node architecture boundary',text:'前端偏全栈岗位里，你如何判断一个问题应该在 Node/服务端解决，还是留在前端？',pressure:'请用状态所有权、性能、可靠性和安全边界解释，而不是只按技术栈偏好。'},
] as const;

const LINKS=[
  {id:'link.fq1.agent-runtime.ai',familyId:'qf.agent-runtime-recovery',evidenceRefId:'ev.demo.agent-runtime-boundary',boundaryId:'cb.demo.agent-runtime-boundary',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq1.context.ai',familyId:'qf.context-access-strategy',evidenceRefId:'ev.demo.context-engineering',boundaryId:'cb.demo.context-engineering',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.fq1.fde-req.fde',familyId:'qf.fde-requirement-decomposition',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.fq1.fde-risk.fde',familyId:'qf.fde-risk-control',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.fq1.frontend-migration.fe',familyId:'qf.frontend-platform-migration',evidenceRefId:'ev.demo.platform-migration',boundaryId:'cb.demo.platform-migration',routeId:'route.advanced-fe-fullstack',strength:'STRONG'},
  {id:'link.fq1.fullstack.fe',familyId:'qf.fullstack-boundary',evidenceRefId:'ev.demo.fullstack-runtime',boundaryId:'cb.demo.fullstack-runtime',routeId:'route.advanced-fe-fullstack',strength:'MEDIUM'},
] as const;

const METHODS=[
  {key:'agent',sourceId:'source.karat',locator:'public-wave1/agent-runtime',kind:'RUBRIC',text:'技术面试应观察问题分解、验证、调试与工具判断，而不是只看最终答案。'},
  {key:'context',sourceId:'source.staffeng',locator:'public-wave1/context',kind:'RUBRIC',text:'高级工程师评价应观察约束下的判断、范围、取舍与可迁移方法。'},
  {key:'fde-req',sourceId:'source.feishu-hire',locator:'public-wave1/fde-requirement',kind:'RUBRIC',text:'结构化面试应围绕能力标签和行为证据持续补证。'},
  {key:'fde-risk',sourceId:'source.eng-rubrics',locator:'public-wave1/fde-risk',kind:'RUBRIC',text:'评分锚点应描述可观察行为并明确正负信号。'},
  {key:'migration',sourceId:'source.frontend-interview-handbook',locator:'public-wave1/migration',kind:'TECHNIQUE',text:'高级前端问题应结合架构、兼容、性能和设计决策。'},
  {key:'fullstack',sourceId:'source.frontend-interview-handbook',locator:'public-wave1/fullstack',kind:'TECHNIQUE',text:'跨栈问题应验证运行时边界、证据和责任归属。'},
] as const;

const METHOD_BY_FAMILY={
  'qf.agent-runtime-recovery':'agent',
  'qf.context-access-strategy':'context',
  'qf.fde-requirement-decomposition':'fde-req',
  'qf.fde-risk-control':'fde-risk',
  'qf.frontend-platform-migration':'migration',
  'qf.fullstack-boundary':'fullstack',
} as const;

const ANCHORS:PublicAnchorSeed[]=FAMILIES.flatMap((row)=>[
  {id:`anchor.fq1.${row.id.slice(3)}.positive`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'POSITIVE',behavior:`能围绕 ${row.name} 说明约束、机制、证据和验证。`},
  {id:`anchor.fq1.${row.id.slice(3)}.negative`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'NEGATIVE',behavior:`只给结论或技术名词，无法说明 ${row.name} 的边界与验证。`},
]);

const EDGES=[
  ['edge.fq1.runtime.follow','qf.agent-runtime-recovery','qf.unknown-boundary','CLARIFY',90],
  ['edge.fq1.context.follow','qf.context-access-strategy','qf.failure-tradeoff','FOLLOW_UP',80],
  ['edge.fq1.fde-risk.follow','qf.fde-requirement-decomposition','qf.fde-risk-control','FOLLOW_UP',90],
  ['edge.fq1.migration.follow','qf.frontend-platform-migration','qf.failure-tradeoff','FOLLOW_UP',85],
] as const;

export function registerFormalQuestionCorpusWave1(db:any,now=new Date().toISOString()){
  registerCandidateInterviewEvidence(db,now);
  return registerPublicCorpusWave(db,{
    wave:'Public Formal Corpus Wave 1',
    variantPrefix:'fq1v',
    families:[...FAMILIES],
    questions:[...QUESTIONS],
    links:[...LINKS],
    methods:[...METHODS],
    anchors:ANCHORS,
    edges:[...EDGES],
  },now);
}
