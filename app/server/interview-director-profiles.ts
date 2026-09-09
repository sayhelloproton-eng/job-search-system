type Pressure='LOW'|'MEDIUM'|'HIGH';
type EvidenceGrade='OFFICIAL'|'MULTI_REPORT'|'SINGLE_REPORT'|'INFERRED'|'USER_REAL'|'USER_REAL_INTERVIEW';
type OverrideScope='SESSION'|'COMPANY_DEFAULT';
type StyleOverride={evidenceGrade:EvidenceGrade;sourceRef?:string;roundBudgetSeconds?:number;pressureBand?:Pressure;hintPolicy?:'NONE'|'MINIMAL'|'BOUNDED'|'COLLABORATIVE';interruptionPolicy?:'RARE'|'TIMEBOXED'|'ACTIVE';maxProbeDepth?:number;[key:string]:unknown};

const BIASES=['PERSONA_SCORE_DRIFT','VOICE_STYLE_AS_ABILITY','DEMOGRAPHIC_INFERENCE'];
const archetype=(id:string,roleName:string,mandate:string,pressureBand:Pressure,hintPolicy:string,interruptionPolicy:string)=>({
  id,roleName,mandate,pressureBand,hintPolicy,interruptionPolicy,forbiddenBiases:BIASES,
});

export const INTERVIEWER_ARCHETYPES:Record<string,any>={
  ENGINEER_SCREEN:archetype('ENGINEER_SCREEN','Engineer','验证技术下限、项目真实性、实现、Debug、边界和验证能力','MEDIUM','BOUNDED','TIMEBOXED'),
  SENIOR_STAFF_TECH:archetype('SENIOR_STAFF_TECH','Senior / Staff Engineer','验证复杂度、Trade-off、Failure、系统边界和能力上限','HIGH','NONE','ACTIVE'),
  HIRING_MANAGER:archetype('HIRING_MANAGER','Hiring Manager / Leader','判断未来可托付 Scope、Ownership、Value、影响与恢复能力','MEDIUM','BOUNDED','TIMEBOXED'),
  FDE_BUSINESS_ENGINEER:archetype('FDE_BUSINESS_ENGINEER','FDE / Business Engineer','验证客户问题分解、技术方案、沟通、交付风险与验收闭环','HIGH','COLLABORATIVE','ACTIVE'),
  RECRUITER:archetype('RECRUITER','Recruiter','验证固定事实、动机、约束与交易风险，不承担技术深度评分','LOW','BOUNDED','RARE'),
};

const mandate=(archetypeId:string,mandate:string,focusSignals:string[])=>({archetypeId,mandate,focusSignals});
export const SCENE_DIRECTOR_MANDATES:Record<string,any>={
  'scene.hr':mandate('RECRUITER','真实性、动机、硬约束和交易风险',['signal.risk','signal.truthfulness','signal.transferability']),
  'scene.tech1':mandate('ENGINEER_SCREEN','技术下限、项目真实性、实现与 Debug',['signal.baseline','signal.truthfulness','signal.judgment','signal.failure']),
  'scene.deep-dive':mandate('SENIOR_STAFF_TECH','Scope、Ownership、判断、Failure 与上限',['signal.ownership','signal.judgment','signal.ceiling','signal.failure']),
  'scene.system-design':mandate('SENIOR_STAFF_TECH','约束、系统边界、Authority、Failure 与 Trade-off',['signal.judgment','signal.ceiling','signal.risk','signal.failure']),
  'scene.coding':mandate('ENGINEER_SCREEN','澄清、实现、测试、Debug 与复杂度控制',['signal.baseline','signal.failure','signal.judgment']),
  'scene.fde-case':mandate('FDE_BUSINESS_ENGINEER','客户目标分解、方案、交付风险、沟通与验收',['signal.judgment','signal.risk','signal.value','signal.transferability']),
  'scene.hm':mandate('HIRING_MANAGER','未来 Scope、Ownership、Value 与迁移性',['signal.scope','signal.ownership','signal.value','signal.transferability']),
  'scene.cross':mandate('HIRING_MANAGER','跨角色协作、冲突、组织接口与迁移性',['signal.transferability','signal.ownership','signal.risk','signal.value']),
  'scene.final':mandate('HIRING_MANAGER','关闭残余风险、方向一致性与长期价值',['signal.risk','signal.truthfulness','signal.value','signal.transferability']),
  'scene.offer':mandate('RECRUITER','BATNA、薪资、到岗和双方交易条件',['signal.risk','signal.truthfulness','signal.value']),
};
const loop=(routeId:string,rounds:any[])=>({id:`loop.default.${routeId}`,routeId,evidenceGrade:'INFERRED',version:1,rounds});
const round=(order:number,sceneId:string,expectedMinutes:number,optional=false)=>({order,sceneId,missionId:`mission.default.${sceneId}`,expectedMinutes,optional});

export const ROUTE_INTERVIEW_LOOPS:Record<string,any>={
  'route.ai-agent-devtools':loop('route.ai-agent-devtools',[
    round(1,'scene.hr',30,true),round(2,'scene.tech1',55),round(3,'scene.deep-dive',60),round(4,'scene.hm',55),round(5,'scene.final',45,true),
  ]),
  'route.advanced-fe-fullstack':loop('route.advanced-fe-fullstack',[
    round(1,'scene.hr',30,true),round(2,'scene.tech1',55),round(3,'scene.deep-dive',60),round(4,'scene.hm',55),round(5,'scene.final',45,true),
  ]),
  'route.tob-fde':loop('route.tob-fde',[
    round(1,'scene.hr',30,true),round(2,'scene.tech1',55),round(3,'scene.fde-case',55),round(4,'scene.deep-dive',60,true),round(5,'scene.hm',55),round(6,'scene.final',45,true),
  ]),
};
export const DEFAULT_INTERVIEW_LOOPS=ROUTE_INTERVIEW_LOOPS;
export function getRouteInterviewLoop(routeId:string){const found=ROUTE_INTERVIEW_LOOPS[routeId];if(!found)throw new Error('DIRECTOR_DEFAULT_ROUTE_NOT_FOUND');return found;}

const focus=(signalId:string,priority:'P0'|'P1'|'P2',required=true,maxProbeDepth=2)=>({signalId,priority,required,targetState:'CONFIRMED' as const,minimumEvidenceCount:1,maxProbeDepth});
const phase=(id:string,order:number,budgetSeconds:number,focusSignalIds:string[],mandatory=true)=>({id,order,budgetSeconds,focusSignalIds,mandatory});
const BASE_PROBE_POLICY={id:'probe.default.v1',maxConsecutiveSameSignal:2,maxConsecutiveSameFamily:2,antiScriptAfterStrongClaim:true,crossCheckStrongOwnershipClaim:true,stopOnExplicitUnknown:true,allowHintAfterClarify:true,challengeModes:['ALTERNATIVE','CONSTRAINT_CHANGE','FAILURE','SCALE','EVIDENCE']};

function focusFor(routeId:string,sceneId:string){
  if(sceneId==='scene.hr') return [focus('signal.risk','P0'),focus('signal.truthfulness','P0'),focus('signal.transferability','P1',false)];
  if(sceneId==='scene.tech1'&&routeId==='route.ai-agent-devtools') return [focus('signal.baseline','P0'),focus('signal.truthfulness','P0'),focus('signal.judgment','P1'),focus('signal.failure','P1')];
  if(sceneId==='scene.tech1'&&routeId==='route.advanced-fe-fullstack') return [focus('signal.baseline','P0'),focus('signal.truthfulness','P0'),focus('signal.failure','P1'),focus('signal.judgment','P1')];
  if(sceneId==='scene.tech1') return [focus('signal.baseline','P0'),focus('signal.ownership','P1'),focus('signal.judgment','P0'),focus('signal.risk','P1')];
  if(sceneId==='scene.deep-dive'&&routeId==='route.ai-agent-devtools') return [focus('signal.ceiling','P0'),focus('signal.ownership','P0',true,3),focus('signal.judgment','P0',true,3),focus('signal.failure','P1')];
  if(sceneId==='scene.deep-dive'&&routeId==='route.advanced-fe-fullstack') return [focus('signal.ownership','P0',true,3),focus('signal.judgment','P0',true,3),focus('signal.ceiling','P1'),focus('signal.scope','P1'),focus('signal.failure','P1')];
  if(sceneId==='scene.deep-dive') return [focus('signal.ownership','P0',true,3),focus('signal.judgment','P0',true,3),focus('signal.failure','P1'),focus('signal.value','P1'),focus('signal.risk','P1')];
  if(sceneId==='scene.system-design') return [focus('signal.judgment','P0',true,3),focus('signal.ceiling','P0'),focus('signal.risk','P1'),focus('signal.failure','P1')];
  if(sceneId==='scene.coding') return [focus('signal.baseline','P0',true,3),focus('signal.failure','P1'),focus('signal.judgment','P1')];
  if(sceneId==='scene.fde-case') return [focus('signal.judgment','P0',true,3),focus('signal.risk','P0',true,3),focus('signal.value','P1'),focus('signal.transferability','P1'),focus('signal.ownership','P1')];
  if(sceneId==='scene.hm'&&routeId==='route.tob-fde') return [focus('signal.ownership','P0'),focus('signal.scope','P0'),focus('signal.value','P0'),focus('signal.risk','P1'),focus('signal.transferability','P1')];
  if(sceneId==='scene.hm') return [focus('signal.scope','P0'),focus('signal.ownership','P0'),focus('signal.value','P0'),focus('signal.transferability','P1')];
  if(sceneId==='scene.cross') return [focus('signal.transferability','P0'),focus('signal.ownership','P1'),focus('signal.risk','P1'),focus('signal.value','P1')];
  if(sceneId==='scene.final') return [focus('signal.risk','P0'),focus('signal.truthfulness','P0'),focus('signal.value','P1'),focus('signal.transferability','P1')];
  return [focus('signal.risk','P0'),focus('signal.truthfulness','P0'),focus('signal.value','P1')];
}

function phasesFor(routeId:string,sceneId:string,signals:string[]){
  const has=(...ids:string[])=>ids.filter(id=>signals.includes(id));
  if(sceneId==='scene.tech1'&&routeId==='route.ai-agent-devtools') return [phase('OPENING',1,300,[]),phase('PROJECT_ANCHOR',2,600,has('signal.truthfulness','signal.judgment')),phase('AGENT_TECHNICAL',3,1200,has('signal.baseline','signal.judgment','signal.failure')),phase('CODING_DEBUG',4,900,has('signal.baseline','signal.failure')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.tech1'&&routeId==='route.advanced-fe-fullstack') return [phase('OPENING',1,300,[]),phase('PROJECT_ANCHOR',2,600,has('signal.truthfulness','signal.judgment')),phase('FE_BASELINE',3,900,has('signal.baseline','signal.failure')),phase('CODING_ENGINEERING',4,1200,has('signal.baseline','signal.judgment','signal.failure')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.tech1') return [phase('OPENING',1,300,[]),phase('PROJECT_TROUBLESHOOT',2,750,has('signal.ownership','signal.risk')),phase('ENGINEERING_BASELINE',3,750,has('signal.baseline','signal.judgment')),phase('REQUIREMENT_DECOMPOSE',4,1200,has('signal.judgment','signal.risk')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.deep-dive'&&routeId==='route.advanced-fe-fullstack') return [phase('OPENING',1,300,[]),phase('PROJECT_DEEP_DIVE',2,900,has('signal.ownership','signal.scope')),phase('FRONTEND_ARCH_PERF',3,1200,has('signal.judgment','signal.ceiling','signal.failure')),phase('FULLSTACK_BOUNDARY',4,900,has('signal.judgment','signal.scope','signal.failure')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.deep-dive') return [phase('OPENING',1,300,[]),phase('PROJECT_DEEP_DIVE',2,900,has('signal.ownership','signal.scope','signal.judgment')),phase('ARCH_FAILURE',3,1200,has('signal.ceiling','signal.judgment','signal.failure','signal.risk')),phase('VALUE_TRANSFER',4,900,has('signal.value','signal.transferability','signal.ownership')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.fde-case') return [phase('OPENING',1,300,[]),phase('REQUIREMENT_CLARIFY',2,600,has('signal.judgment','signal.risk')),phase('SOLUTION_BOUNDARY',3,900,has('signal.judgment','signal.transferability')),phase('DELIVERY_RISK',4,900,has('signal.risk','signal.ownership')),phase('ACCEPTANCE_TRADEOFF',5,600,has('signal.value','signal.judgment')),phase('CANDIDATE_QUESTIONS',6,300,[])];
  if(sceneId==='scene.system-design') return [phase('OPENING',1,300,[]),phase('REQUIREMENTS',2,480,has('signal.judgment','signal.risk')),phase('ARCHITECTURE',3,1200,has('signal.judgment','signal.ceiling')),phase('FAILURE_TRADEOFF',4,900,has('signal.failure','signal.risk','signal.judgment')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.coding') return [phase('OPENING',1,240,[]),phase('CLARIFY_PLAN',2,360,has('signal.baseline','signal.judgment')),phase('IMPLEMENT',3,1200,has('signal.baseline')),phase('TEST_DEBUG',4,840,has('signal.failure','signal.judgment')),phase('WRAP',5,300,[])];
  if(sceneId==='scene.hm') return [phase('OPENING',1,300,[]),phase('SCOPE_OWNERSHIP',2,1050,has('signal.scope','signal.ownership')),phase('VALUE_FAILURE',3,1050,has('signal.value','signal.risk')),phase('FUTURE_TRANSFER',4,600,has('signal.transferability','signal.value')),phase('CANDIDATE_QUESTIONS',5,300,[])];
  if(sceneId==='scene.hr'||sceneId==='scene.offer') return [phase('OPENING',1,180,[]),phase('FACTS',2,600,has('signal.truthfulness','signal.risk')),phase('MOTIVATION_CONSTRAINTS',3,720,has('signal.risk','signal.transferability','signal.value')),phase('CANDIDATE_QUESTIONS',4,300,[])];
  return [phase('OPENING',1,300,[]),phase('PRIMARY_EVIDENCE',2,900,signals.slice(0,2)),phase('CROSS_CHECK',3,900,signals.slice(1)),phase('CANDIDATE_QUESTIONS',4,300,[])];
}

function purposeFor(routeId:string,sceneId:string){
  if(sceneId==='scene.tech1'&&routeId==='route.ai-agent-devtools') return '验证项目真实性、Agent 工程下限、实现与 Debug 能力';
  if(sceneId==='scene.tech1'&&routeId==='route.advanced-fe-fullstack') return '验证前端核心下限、项目真实性、Coding 与工程判断';
  if(sceneId==='scene.tech1') return '验证工程基础、独立拆解、排障与交付迁移性';
  if(sceneId==='scene.deep-dive') return '验证复杂项目中的 Scope、Ownership、判断、Failure 与能力上限';
  if(sceneId==='scene.fde-case') return '验证模糊客户问题到可验收方案的分解、风险与价值判断';
  if(sceneId==='scene.hm') return '判断过去证据能否迁移为未来可托付 Scope 与价值';
  return SCENE_DIRECTOR_MANDATES[sceneId]?.mandate??'获取本轮岗位相关可验证 Signal';
}

function applyBudget(phases:any[],budget:number){
  const total=phases.reduce((n,p)=>n+p.budgetSeconds,0);if(!Number.isFinite(budget)||budget<=0)throw new Error('DIRECTOR_OVERRIDE_BUDGET_INVALID');
  let used=0;return phases.map((p,i)=>{if(i===phases.length-1)return {...p,budgetSeconds:Math.max(60,budget-used)};const next=Math.max(60,Math.round(p.budgetSeconds/total*budget));used+=next;return {...p,budgetSeconds:next};});
}
function normalizeGrade(grade:EvidenceGrade){return grade==='USER_REAL_INTERVIEW'?'USER_REAL':grade;}
function validateOverride(override:StyleOverride){
  const grade=normalizeGrade(override.evidenceGrade);if(!['OFFICIAL','MULTI_REPORT','USER_REAL'].includes(grade))throw new Error('DIRECTOR_OVERRIDE_EVIDENCE_INSUFFICIENT');
  for(const key of ['routeId','sceneId','focusSignals','scoreWeights','signalWeights','phases','completionRule','purpose']) if(key in override)throw new Error('DIRECTOR_OVERRIDE_FORBIDDEN_AUTHORITY');
  return grade;
}
export function buildDefaultDirectorPlan(input:{routeId:string;sceneId:string;override?:StyleOverride}|string,legacySceneId?:string){
  const routeId=typeof input==='string'?input:input.routeId;const sceneId=typeof input==='string'?String(legacySceneId):input.sceneId;const override=typeof input==='string'?undefined:input.override;
  getRouteInterviewLoop(routeId);const scene=SCENE_DIRECTOR_MANDATES[sceneId];if(!scene)throw new Error('DIRECTOR_DEFAULT_SCENE_NOT_FOUND');
  const base=INTERVIEWER_ARCHETYPES[scene.archetypeId];const focusSignals=focusFor(routeId,sceneId);let phases=phasesFor(routeId,sceneId,focusSignals.map(f=>f.signalId));
  const archetype={...base};const probePolicy={...BASE_PROBE_POLICY};let overrideEvidence:any=undefined;
  if(override){const grade=validateOverride(override);if(override.roundBudgetSeconds!==undefined)phases=applyBudget(phases,Number(override.roundBudgetSeconds));if(override.pressureBand)archetype.pressureBand=override.pressureBand;if(override.hintPolicy)archetype.hintPolicy=override.hintPolicy;if(override.interruptionPolicy)archetype.interruptionPolicy=override.interruptionPolicy;if(override.maxProbeDepth!==undefined){const depth=Number(override.maxProbeDepth);if(!Number.isInteger(depth)||depth<1||depth>4)throw new Error('DIRECTOR_OVERRIDE_PROBE_DEPTH_INVALID');probePolicy.maxConsecutiveSameSignal=depth;}overrideEvidence={grade,sourceRef:override.sourceRef??null};}
  return {id:`mission.default.${routeId}.${sceneId}.v1`,routeId,sceneId,purpose:purposeFor(routeId,sceneId),roundBudgetSeconds:phases.reduce((n,p)=>n+p.budgetSeconds,0),completionRule:'MANDATORY_PHASES_AND_FOCUS',archetype,probePolicy,focusSignals,incidentalSignals:[],phases,...(overrideEvidence?{overrideEvidence}:{})};
}

export function getDirectorProfileSummary(){
  return {archetypes:Object.keys(INTERVIEWER_ARCHETYPES).length,sceneMandates:Object.keys(SCENE_DIRECTOR_MANDATES).length,routeLoops:Object.fromEntries(Object.entries(ROUTE_INTERVIEW_LOOPS).map(([id,loop]:any)=>[id,{id:loop.id,rounds:loop.rounds.map((r:any)=>({order:r.order,sceneId:r.sceneId,expectedMinutes:r.expectedMinutes,optional:r.optional}))}]))};
}

export function canApplyCompanyLoopOverride(input:{grade:EvidenceGrade;scope:OverrideScope}){
  const grade=normalizeGrade(input.grade);if(grade==='OFFICIAL'||grade==='MULTI_REPORT')return true;if(grade==='USER_REAL')return input.scope==='SESSION';return false;
}
