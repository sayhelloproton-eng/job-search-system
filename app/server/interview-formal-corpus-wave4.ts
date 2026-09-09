import { registerFormalQuestionCorpusWave3 } from './interview-formal-corpus-wave3.ts';
import { registerPublicCorpusWave, type PublicAnchorSeed } from './interview-corpus-utils.ts';

const FAMILIES=[
  {id:'qf.recruiter-career-constraint-risk',name:'Recruiter Career & Constraint Risk',signalId:'signal.risk',intent:'验证职业动机、稳定性和硬约束在招聘初筛中的一致性',decisionPattern:'Fact → Motivation/Constraint → Consistency → Tradeability → Risk'},
  {id:'qf.frontend-runtime-baseline',name:'Frontend Runtime Baseline',signalId:'signal.baseline',intent:'验证 Browser、JavaScript Runtime 与前端执行模型的基础下限',decisionPattern:'Symptom → Runtime Model → Measurement → Localize → Verify'},
  {id:'qf.devtools-value-adoption',name:'Developer Tools Value & Adoption',signalId:'signal.value',intent:'验证 Developer Tools 如何用 Adoption、Quality、Reliability 与 Evidence 证明价值',decisionPattern:'User Friction → Engineering Change → Evidence → Value Boundary → Continue/Stop'},
] as const;

const QUESTIONS=[
  {id:'fq4.recruiter.01',familyId:'qf.recruiter-career-constraint-risk',difficulty:'STANDARD',tags:'scene.hr-recruiter career motivation transition stability',text:'为什么你现在看新的机会，而且会同时考虑几类相邻岗位？这条职业演进怎么解释才不是“什么都想做”？',pressure:'如果新岗位仍有大量已有技术栈工作，你会不会做一段时间又想转走？'},
  {id:'fq4.recruiter.02',familyId:'qf.recruiter-career-constraint-risk',difficulty:'STANDARD',tags:'scene.hr-recruiter leaving education location availability compensation',text:'HR 连续追问离职原因、学历、地点、到岗和薪资时，你如何区分固定事实、可协商条件和暂时不能确认的信息？',pressure:'如果对方要求现在给一个确定数字或日期，但条件尚未确认，怎么保持前后口径一致？'},
  {id:'fq4.frontend-baseline.01',familyId:'qf.frontend-runtime-baseline',difficulty:'SENIOR',tags:'route.advanced-fe-fullstack browser javascript runtime render performance',text:'页面交互明显卡顿，但网络请求很快，你会怎样区分 JavaScript 长任务、频繁渲染或布局和框架更新造成的问题？',pressure:'主线程很忙时，怎么从现象继续定位到可验证原因？'},
  {id:'fq4.frontend-baseline.02',familyId:'qf.frontend-runtime-baseline',difficulty:'SENIOR',tags:'route.advanced-fe-fullstack javascript event loop async race state ownership',text:'一个异步请求回来后 UI 出现旧数据覆盖新数据，你如何从事件循环、任务顺序和状态 ownership 解释并修复？',pressure:'如果加 debounce 能让问题消失，为什么这还不算证明根因已经解决？'},
  {id:'fq4.devtools-value.01',familyId:'qf.devtools-value-adoption',difficulty:'SENIOR',tags:'route.ai-agent-devtools developer tools adoption usage quality reliability value',text:'Developer Tool 没有直接收入 KPI 时，你会用什么证据判断它真的改善了研发流程，而不是只是有人在用？',pressure:'如果 usage 很高，但无法证明效率提升，你会把它算成功吗？为什么？'},
  {id:'fq4.devtools-value.02',familyId:'qf.devtools-value-adoption',difficulty:'SENIOR',tags:'route.ai-agent-devtools value adoption freshness reliability measurement',text:'一个 AI 工程工具已经能工作，但可靠性、知识 freshness 和使用成本还在演进，你如何决定继续投入、收缩还是停止？',pressure:'如果业务方只要一个提效百分比，如何给出可验证证据而不把推断当事实？'},
] as const;

const LINKS=[
  {id:'link.fq4.frontend-baseline.fe',familyId:'qf.frontend-runtime-baseline',evidenceRefId:'ev.demo.fullstack-runtime',boundaryId:'cb.demo.fullstack-runtime',routeId:'route.advanced-fe-fullstack',strength:'MEDIUM'},
  {id:'link.fq4.devtools-value.ai',familyId:'qf.devtools-value-adoption',evidenceRefId:'ev.demo.usage-observability',boundaryId:'cb.demo.usage-observability',routeId:'route.ai-agent-devtools',strength:'STRONG'},
] as const;

const METHODS=[
  {key:'recruiter',sourceId:'source.feishu-hire',locator:'public-wave4/recruiter-risk',kind:'RUBRIC',text:'Recruiter 初筛应围绕稳定事实、岗位动机、硬约束与风险一致性取证。'},
  {key:'frontend',sourceId:'source.frontend-interview-handbook',locator:'public-wave4/frontend-runtime',kind:'TECHNIQUE',text:'高级前端基础评价应观察 Browser、JavaScript Runtime、性能与状态问题的机制和诊断过程。'},
  {key:'value',sourceId:'source.staffeng',locator:'public-wave4/devtools-value',kind:'RUBRIC',text:'Senior/Staff 价值判断应把工程动作连接到用户与系统结果，并明确证据和归因边界。'},
] as const;
const METHOD_BY_FAMILY={
  'qf.recruiter-career-constraint-risk':'recruiter',
  'qf.frontend-runtime-baseline':'frontend',
  'qf.devtools-value-adoption':'value',
} as const;
const ANCHORS:PublicAnchorSeed[]=FAMILIES.flatMap((row)=>[
  {id:`anchor.fq4.${row.id.slice(3)}.positive`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'POSITIVE',behavior:`能围绕 ${row.name} 区分事实、证据、风险与可验证判断。`},
  {id:`anchor.fq4.${row.id.slice(3)}.negative`,familyId:row.id,signalId:row.signalId,methodKey:METHOD_BY_FAMILY[row.id],polarity:'NEGATIVE',behavior:`在 ${row.name} 中靠临时口径、模糊指标或框架偏好替代证据。`},
]);
const EDGES=[
  ['edge.fq4.recruiter.follow','qf.recruiter-career-constraint-risk','qf.jd-role-fit-mapping','FOLLOW_UP',85],
  ['edge.fq4.frontend.follow','qf.frontend-runtime-baseline','qf.coding-debugging-strategy','FOLLOW_UP',90],
  ['edge.fq4.value.challenge','qf.devtools-value-adoption','qf.negative-eval-decision','CHALLENGE',85],
] as const;

export function registerFormalQuestionCorpusWave4(db:any,now=new Date().toISOString()){
  registerFormalQuestionCorpusWave3(db,now);
  return registerPublicCorpusWave(db,{
    wave:'Public Formal Corpus Wave 4',variantPrefix:'fq4v',
    families:[...FAMILIES],questions:[...QUESTIONS],links:[...LINKS],methods:[...METHODS],anchors:ANCHORS,edges:[...EDGES],
  },now);
}
