import { readFileSync } from 'node:fs';

type EvidenceStatus = 'SUPPORTED'|'PARTIAL';
type SourceKind = 'CAREER_FACT'|'ACCEPTED_PROJECT';

type EvidenceSeed = {
  id:string;
  stableKey:string;
  canonicalPath:string;
  canonicalKey:string;
  sourceKind:SourceKind;
  evidenceStatus:EvidenceStatus;
  shortHint:string;
};

type BoundarySeed = {
  id:string;
  evidenceRefId:string;
  boundaryType:'SAFE_DIRECT'|'QUALIFIED';
  allowedClaim:string;
  requiredQualifier:string;
  forbiddenExpansion:string;
};

type LinkSeed = {
  id:string;
  familyId:string;
  evidenceRefId:string;
  boundaryId:string;
  routeId:string;
  strength:'STRONG'|'MEDIUM'|'WEAK'|'DEFENSIVE';
};

type BlueprintSeed = {
  id:string;
  familyId:string;
  evidenceRefId:string;
  routeId:string;
  l1:string;
  l2:string[];
  l3:string[];
  l4:string[];
};

type CandidateEvidenceBundle = {
  evidence:EvidenceSeed[];
  boundaries:BoundarySeed[];
  links:LinkSeed[];
  blueprints:BlueprintSeed[];
};

const DEMO_EVIDENCE:EvidenceSeed[] = [
  {id:'ev.demo.platform-delivery',stableKey:'demo.platform-delivery',canonicalPath:'examples/candidate/evidence/platform-delivery.md',canonicalKey:'DEMO#platform-delivery',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic multi-environment platform delivery evidence.'},
  {id:'ev.demo.platform-migration',stableKey:'demo.platform-migration',canonicalPath:'examples/candidate/evidence/platform-migration.md',canonicalKey:'DEMO#platform-migration',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic shared-platform migration and compatibility evidence.'},
  {id:'ev.demo.devtools-ownership',stableKey:'demo.devtools-ownership',canonicalPath:'examples/candidate/evidence/devtools-ownership.md',canonicalKey:'DEMO#devtools-ownership',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic developer-tooling solution ownership evidence.'},
  {id:'ev.demo.workflow-recovery',stableKey:'demo.workflow-recovery',canonicalPath:'examples/candidate/evidence/workflow-recovery.md',canonicalKey:'DEMO#workflow-recovery',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic workflow lifecycle failure and durable recovery evidence.'},
  {id:'ev.demo.agent-runtime-boundary',stableKey:'demo.agent-runtime-boundary',canonicalPath:'examples/candidate/evidence/agent-runtime-boundary.md',canonicalKey:'DEMO#agent-runtime-boundary',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic Agent Runtime authority and recovery evidence.'},
  {id:'ev.demo.fullstack-runtime',stableKey:'demo.fullstack-runtime',canonicalPath:'examples/candidate/evidence/fullstack-runtime.md',canonicalKey:'DEMO#fullstack-runtime',sourceKind:'CAREER_FACT',evidenceStatus:'PARTIAL',shortHint:'Synthetic frontend/Node/SSR runtime evidence.'},
  {id:'ev.demo.platform-observability',stableKey:'demo.platform-observability',canonicalPath:'examples/candidate/evidence/platform-observability.md',canonicalKey:'DEMO#platform-observability',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic shared-platform observability ownership evidence.'},
  {id:'ev.demo.context-engineering',stableKey:'demo.context-engineering',canonicalPath:'examples/candidate/evidence/context-engineering.md',canonicalKey:'DEMO#context-engineering',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic large-repository context access evidence.'},
  {id:'ev.demo.registry-governance',stableKey:'demo.registry-governance',canonicalPath:'examples/candidate/evidence/registry-governance.md',canonicalKey:'DEMO#registry-governance',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic registry/CLI freshness governance evidence.'},
  {id:'ev.demo.usage-observability',stableKey:'demo.usage-observability',canonicalPath:'examples/candidate/evidence/usage-observability.md',canonicalKey:'DEMO#usage-observability',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic usage, metric and inference boundary evidence.'},
  {id:'ev.demo.architecture-restart',stableKey:'demo.architecture-restart',canonicalPath:'examples/candidate/evidence/architecture-restart.md',canonicalKey:'DEMO#architecture-restart',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic architecture restart decision evidence.'},
  {id:'ev.demo.dev-harness',stableKey:'demo.dev-harness',canonicalPath:'examples/candidate/evidence/dev-harness.md',canonicalKey:'DEMO#dev-harness',sourceKind:'ACCEPTED_PROJECT',evidenceStatus:'SUPPORTED',shortHint:'Synthetic AI development harness evidence.'},
];

const boundary = (
  id:string,
  evidenceRefId:string,
  allowedClaim:string,
  requiredQualifier:string,
  forbiddenExpansion:string,
  boundaryType:'SAFE_DIRECT'|'QUALIFIED'='QUALIFIED',
):BoundarySeed => ({id,evidenceRefId,boundaryType,allowedClaim,requiredQualifier,forbiddenExpansion});

const DEMO_BOUNDARIES:BoundarySeed[] = [
  boundary('cb.demo.platform-delivery','ev.demo.platform-delivery','参与多环境平台交付，负责前端能力、共享组件与差异治理。','这是 synthetic fixture；真实候选人必须提供自己的证据。','不得把示例项目数、客户价值或团队结果改写成真实个人履历。','SAFE_DIRECT'),
  boundary('cb.demo.platform-migration','ev.demo.platform-migration','处理共享平台迁移的依赖清单、兼容窗口和退场验收。','只用于演示迁移回答结构。','不得制造真实事故、RCA、业务损失或个人 ownership。'),
  boundary('cb.demo.devtools-ownership','ev.demo.devtools-ownership','在团队工具项目中主导部分方案与工程化演进。','方案 ownership 与每个文件 authorship 分开。','不得把 synthetic fixture 当作真实雇佣经历。','SAFE_DIRECT'),
  boundary('cb.demo.workflow-recovery','ev.demo.workflow-recovery','长任务生命周期失败后改为有界步骤、结构化结果与 durable state 恢复。','只用于演示 failure-driven architecture。','不得把示例失败次数或可靠性改写成真实指标。','SAFE_DIRECT'),
  boundary('cb.demo.agent-runtime-boundary','ev.demo.agent-runtime-boundary','在个人 sandbox 中探索 Agent Runtime 的 Authority、Effect 与 Recovery 边界。','个人 sandbox 不等于企业生产系统。','不得声称生产 SLA、真实用户规模或 exactly-once。'),
  boundary('cb.demo.fullstack-runtime','ev.demo.fullstack-runtime','使用 SSR/Node synthetic case 解释浏览器、服务端、发布与监控边界。','证据等级仅为 demo PARTIAL。','不得升级为真实后端主责或雇佣经历。'),
  boundary('cb.demo.platform-observability','ev.demo.platform-observability','演示共享产品观测、前端 ownership 与后端 telemetry 的责任分离。','只讨论边界与方法。','不得制造真实 SLA、MTTR 或事故数字。'),
  boundary('cb.demo.context-engineering','ev.demo.context-engineering','用 summary、structure、targeted source 与 Runtime Guard 控制大仓上下文。','工具实现与使用策略必须分开归属。','不得制造未测量的 token/效率倍数。','SAFE_DIRECT'),
  boundary('cb.demo.registry-governance','ev.demo.registry-governance','把机器事实从复制文本收敛到 registry/CLI 以改善 freshness 和寻址确定性。','负面评测和未证明收益必须保留。','不得把文件数量变化换算成业务 ROI。','SAFE_DIRECT'),
  boundary('cb.demo.usage-observability','ev.demo.usage-observability','区分 usage fact、deterministic metric 与 model inference，并让观测链 fail-open。','这是 synthetic telemetry example。','不得把 usage 直接包装成真实提效或 ROI。'),
  boundary('cb.demo.architecture-restart','ev.demo.architecture-restart','工作原型暴露 ownership 错误后重写实现，只迁移被验证的语义。','Architecture Restart 需要现实证据而非技术偏好。','不得改写成真实企业重构项目。'),
  boundary('cb.demo.dev-harness','ev.demo.dev-harness','把 Context、Structure、Execution、Reality 分层，降低模型直接拥有系统 Authority 的范围。','外部工具能力不归候选人 ownership。','不得把组合使用外部工具说成实现了这些工具。'),
];

const DEMO_LINKS:LinkSeed[] = [
  {id:'link.demo.platform.ownership.fde',familyId:'qf.ownership',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.tob-fde',strength:'STRONG'},
  {id:'link.demo.platform.ownership.fe',familyId:'qf.ownership',evidenceRefId:'ev.demo.platform-delivery',boundaryId:'cb.demo.platform-delivery',routeId:'route.advanced-fe-fullstack',strength:'STRONG'},
  {id:'link.demo.platform.failure.fe',familyId:'qf.failure-tradeoff',evidenceRefId:'ev.demo.platform-migration',boundaryId:'cb.demo.platform-migration',routeId:'route.advanced-fe-fullstack',strength:'STRONG'},
  {id:'link.demo.devtools.ownership.ai',familyId:'qf.ownership',evidenceRefId:'ev.demo.devtools-ownership',boundaryId:'cb.demo.devtools-ownership',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.demo.devtools.ownership.fde',familyId:'qf.ownership',evidenceRefId:'ev.demo.devtools-ownership',boundaryId:'cb.demo.devtools-ownership',routeId:'route.tob-fde',strength:'MEDIUM'},
  {id:'link.demo.workflow.failure.ai',familyId:'qf.failure-tradeoff',evidenceRefId:'ev.demo.workflow-recovery',boundaryId:'cb.demo.workflow-recovery',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.demo.workflow.failure.fde',familyId:'qf.failure-tradeoff',evidenceRefId:'ev.demo.workflow-recovery',boundaryId:'cb.demo.workflow-recovery',routeId:'route.tob-fde',strength:'MEDIUM'},
  {id:'link.demo.runtime.build.ai',familyId:'qf.build-vs-buy',evidenceRefId:'ev.demo.agent-runtime-boundary',boundaryId:'cb.demo.agent-runtime-boundary',routeId:'route.ai-agent-devtools',strength:'STRONG'},
  {id:'link.demo.runtime.unknown.ai',familyId:'qf.unknown-boundary',evidenceRefId:'ev.demo.agent-runtime-boundary',boundaryId:'cb.demo.agent-runtime-boundary',routeId:'route.ai-agent-devtools',strength:'DEFENSIVE'},
];

const DEMO_BLUEPRINTS:BlueprintSeed[] = [
  {
    id:'bp.demo.platform.ownership.fde',familyId:'qf.ownership',evidenceRefId:'ev.demo.platform-delivery',routeId:'route.tob-fde',
    l1:'我会先把团队交付背景和个人 change surface 分开，再说明自己真正承担的边界。',
    l2:['先交代系统/客户背景','再说明本人直接负责的能力和判断','最后明确不归本人 ownership 的层'],
    l3:['把共性和环境差异分开','高风险动作需要 guard/approval/verification'],
    l4:['synthetic platform-delivery evidence','不把团队结果换算成个人虚构指标'],
  },
  {
    id:'bp.demo.devtools.ownership.ai',familyId:'qf.ownership',evidenceRefId:'ev.demo.devtools-ownership',routeId:'route.ai-agent-devtools',
    l1:'团队工具项目里我会区分问题定义、方案 ownership、实现协作和最终验证。',
    l2:['说明已有基础','说明本人主导的决策','说明实现协作边界'],
    l3:['语义判断交给 Agent','Git/Process/State/Gate 等确定性真值留在程序'],
    l4:['synthetic developer-tooling evidence','solution ownership != every-file authorship'],
  },
  {
    id:'bp.demo.workflow.failure.ai',familyId:'qf.failure-tradeoff',evidenceRefId:'ev.demo.workflow-recovery',routeId:'route.ai-agent-devtools',
    l1:'多轮局部修复仍暴露同一生命周期问题时，应重新判断模型而不是继续修 watcher。',
    l2:['原方案为什么合理','什么现实证据推翻假设','新模型如何收窄 failure surface'],
    l3:['one bounded task','structured result','durable recovery state'],
    l4:['synthetic workflow-recovery evidence','不制造业务 ROI'],
  },
  {
    id:'bp.demo.runtime.build.ai',familyId:'qf.build-vs-buy',evidenceRefId:'ev.demo.agent-runtime-boundary',routeId:'route.ai-agent-devtools',
    l1:'Build vs Buy 先判断这个能力是否定义本系统的 Truth/Authority，而不是先看是否能自己写。',
    l2:['成熟 mechanism 优先复用','业务 Truth/Authority 必须有明确 owner','无独立 ownership 的抽象应删除'],
    l3:['外部 mechanism 通过 adapter 隔离','内部状态/审批/恢复由 control code 持有'],
    l4:['synthetic agent-runtime-boundary evidence','个人 sandbox 不等于企业生产'],
  },
];

function loadBundle():CandidateEvidenceBundle {
  const path = process.env.CANDIDATE_EVIDENCE_FILE?.trim();
  if (!path) {
    return {
      evidence:DEMO_EVIDENCE,
      boundaries:DEMO_BOUNDARIES,
      links:DEMO_LINKS,
      blueprints:DEMO_BLUEPRINTS,
    };
  }
  const parsed = JSON.parse(readFileSync(path,'utf8')) as CandidateEvidenceBundle;
  if (!Array.isArray(parsed.evidence) || !Array.isArray(parsed.boundaries) || !Array.isArray(parsed.links) || !Array.isArray(parsed.blueprints)) {
    throw new Error('CANDIDATE_EVIDENCE_FILE_INVALID');
  }
  return parsed;
}

export const CANDIDATE_EVIDENCE_SEEDS = DEMO_EVIDENCE;

export function registerCandidateInterviewEvidence(db:any, now = new Date().toISOString()) {
  const bundle = loadBundle();
  db.exec('BEGIN;');
  try {
    const evidence = db.prepare(`INSERT INTO interview_evidence_refs(
      id,stable_key,canonical_path,canonical_key,source_kind,evidence_status,short_hint,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET stable_key=excluded.stable_key,canonical_path=excluded.canonical_path,
      canonical_key=excluded.canonical_key,source_kind=excluded.source_kind,evidence_status=excluded.evidence_status,
      short_hint=excluded.short_hint,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for (const row of bundle.evidence) evidence.run(
      row.id,row.stableKey,row.canonicalPath,row.canonicalKey,row.sourceKind,row.evidenceStatus,row.shortHint,now,now
    );

    const claim = db.prepare(`INSERT INTO interview_claim_boundaries(
      id,evidence_ref_id,boundary_type,allowed_claim,required_qualifier,forbidden_expansion,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET evidence_ref_id=excluded.evidence_ref_id,boundary_type=excluded.boundary_type,
      allowed_claim=excluded.allowed_claim,required_qualifier=excluded.required_qualifier,
      forbidden_expansion=excluded.forbidden_expansion,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for (const row of bundle.boundaries) claim.run(
      row.id,row.evidenceRefId,row.boundaryType,row.allowedClaim,row.requiredQualifier,row.forbiddenExpansion,now,now
    );

    const link = db.prepare(`INSERT INTO interview_question_evidence_links(
      id,question_family_id,evidence_ref_id,claim_boundary_id,route_id,strength,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,evidence_ref_id=excluded.evidence_ref_id,
      claim_boundary_id=excluded.claim_boundary_id,route_id=excluded.route_id,strength=excluded.strength,
      lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for (const row of bundle.links) link.run(
      row.id,row.familyId,row.evidenceRefId,row.boundaryId,row.routeId,row.strength,now,now
    );

    const blueprint = db.prepare(`INSERT INTO interview_answer_blueprints(
      id,question_family_id,evidence_ref_id,route_id,l1_conclusion,l2_reasons_json,l3_mechanism_json,l4_evidence_json,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,evidence_ref_id=excluded.evidence_ref_id,
      route_id=excluded.route_id,l1_conclusion=excluded.l1_conclusion,l2_reasons_json=excluded.l2_reasons_json,
      l3_mechanism_json=excluded.l3_mechanism_json,l4_evidence_json=excluded.l4_evidence_json,
      lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for (const row of bundle.blueprints) blueprint.run(
      row.id,row.familyId,row.evidenceRefId,row.routeId,row.l1,
      JSON.stringify(row.l2),JSON.stringify(row.l3),JSON.stringify(row.l4),now,now
    );

    db.exec('COMMIT;');
    return {
      evidence:bundle.evidence.length,
      boundaries:bundle.boundaries.length,
      links:bundle.links.length,
      blueprints:bundle.blueprints.length,
      source:process.env.CANDIDATE_EVIDENCE_FILE ? 'PRIVATE_FILE' : 'SYNTHETIC_DEMO',
    };
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  }
}
