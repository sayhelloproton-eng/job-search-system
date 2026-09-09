PRAGMA foreign_keys = ON;

CREATE TABLE interview_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK(grade IN ('A','B','C')),
  source_type TEXT,
  author_or_org TEXT,
  canonical_url TEXT,
  language TEXT NOT NULL DEFAULT 'zh-CN',
  trust_note TEXT,
  license_note TEXT,
  last_verified_at TEXT,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','STALE','DEPRECATED','OBSERVATION_ONLY')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interview_source_documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES interview_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  canonical_url TEXT,
  published_at TEXT,
  captured_at TEXT,
  content_hash TEXT NOT NULL,
  summary TEXT,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','STALE','DEPRECATED','OBSERVATION_ONLY')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_id, content_hash)
);CREATE TABLE interview_source_units (
  id TEXT PRIMARY KEY,
  source_document_id TEXT NOT NULL REFERENCES interview_source_documents(id) ON DELETE CASCADE,
  provenance_key TEXT NOT NULL UNIQUE,
  unit_kind TEXT NOT NULL CHECK(unit_kind IN ('QUESTION','RUBRIC','TECHNIQUE','NEGOTIATION','MARKET_OBSERVATION','SCORING_ANCHOR','FOLLOW_UP','OTHER')),
  source_locator TEXT,
  summary TEXT NOT NULL,
  normalized_text TEXT,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','STALE','DEPRECATED','OBSERVATION_ONLY')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_source_units_document ON interview_source_units(source_document_id, lifecycle);

CREATE TABLE interview_signals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interview_role_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);CREATE TABLE interview_scene_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  interviewer_role TEXT,
  evidence_gate TEXT NOT NULL,
  description TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interview_question_families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  primary_signal_id TEXT REFERENCES interview_signals(id),
  normalized_intent TEXT,
  decision_pattern TEXT,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('DRAFT','ACTIVE','DEPRECATED','REPLACED','OBSERVATION_ONLY')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  supersedes_id TEXT REFERENCES interview_question_families(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_question_families_signal ON interview_question_families(primary_signal_id, lifecycle);

CREATE TABLE interview_questions (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id),
  source_unit_id TEXT REFERENCES interview_source_units(id),
  canonical_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'zh-CN',
  difficulty TEXT NOT NULL DEFAULT 'STANDARD' CHECK(difficulty IN ('FOUNDATION','STANDARD','SENIOR','STAFF','UNKNOWN')),
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('DRAFT','ACTIVE','DEPRECATED','REPLACED','OBSERVATION_ONLY')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);CREATE INDEX ix_interview_questions_family ON interview_questions(question_family_id, lifecycle);

CREATE TABLE interview_question_variants (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  source_unit_id TEXT REFERENCES interview_source_units(id),
  text TEXT NOT NULL,
  tone TEXT,
  pressure_mode TEXT,
  language TEXT NOT NULL DEFAULT 'zh-CN',
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('DRAFT','ACTIVE','DEPRECATED','REPLACED','OBSERVATION_ONLY')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_question_variants_question ON interview_question_variants(question_id, lifecycle);

CREATE TABLE interview_question_edges (
  id TEXT PRIMARY KEY,
  from_question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  to_question_family_id TEXT REFERENCES interview_question_families(id),
  to_question_id TEXT REFERENCES interview_questions(id),
  edge_type TEXT NOT NULL CHECK(edge_type IN ('FOLLOW_UP','CHALLENGE','ALTERNATIVE','PREREQUISITE','ESCALATION','CLARIFY')),
  priority INTEGER NOT NULL DEFAULT 0,
  condition_json TEXT NOT NULL DEFAULT '{}',
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((to_question_family_id IS NOT NULL) != (to_question_id IS NOT NULL))
);
CREATE INDEX ix_interview_question_edges_from ON interview_question_edges(from_question_family_id, edge_type, priority DESC);
CREATE TABLE interview_scoring_anchors (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL REFERENCES interview_signals(id),
  source_unit_id TEXT REFERENCES interview_source_units(id),
  polarity TEXT NOT NULL CHECK(polarity IN ('POSITIVE','NEGATIVE','STRONG_POSITIVE','STRONG_NEGATIVE')),
  observable_behavior TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_scoring_family_signal ON interview_scoring_anchors(question_family_id, signal_id, polarity);

CREATE TABLE interview_evidence_refs (
  id TEXT PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE,
  canonical_path TEXT NOT NULL,
  canonical_key TEXT,
  source_kind TEXT NOT NULL DEFAULT 'CAREER_ASSET' CHECK(source_kind IN ('CAREER_FACT','FACT_LEDGER','ACCEPTED_PROJECT','STORY','RESUME','CAREER_ASSET')),
  evidence_status TEXT NOT NULL CHECK(evidence_status IN ('SUPPORTED','PARTIAL','TRANSFERABLE','GAP')),
  short_hint TEXT,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','STALE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interview_claim_boundaries (
  id TEXT PRIMARY KEY,
  evidence_ref_id TEXT NOT NULL REFERENCES interview_evidence_refs(id) ON DELETE CASCADE,
  boundary_type TEXT NOT NULL CHECK(boundary_type IN ('SAFE_DIRECT','QUALIFIED','TRANSFERABLE_ONLY','GAP','FORBIDDEN_EXPANSION')),
  allowed_claim TEXT,
  required_qualifier TEXT,
  forbidden_expansion TEXT,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, evidence_ref_id)
);CREATE TABLE interview_question_evidence_links (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  evidence_ref_id TEXT NOT NULL REFERENCES interview_evidence_refs(id) ON DELETE CASCADE,
  claim_boundary_id TEXT NOT NULL,
  route_id TEXT REFERENCES interview_role_profiles(id),
  strength TEXT NOT NULL CHECK(strength IN ('STRONG','MEDIUM','WEAK','DEFENSIVE')),
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(claim_boundary_id, evidence_ref_id)
    REFERENCES interview_claim_boundaries(id, evidence_ref_id)
);
CREATE INDEX ix_interview_evidence_links_family ON interview_question_evidence_links(question_family_id, route_id, strength);
CREATE INDEX ix_interview_evidence_links_evidence ON interview_question_evidence_links(evidence_ref_id);

CREATE TABLE interview_answer_blueprints (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  evidence_ref_id TEXT REFERENCES interview_evidence_refs(id),
  route_id TEXT REFERENCES interview_role_profiles(id),
  l1_conclusion TEXT,
  l2_reasons_json TEXT NOT NULL DEFAULT '[]',
  l3_mechanism_json TEXT NOT NULL DEFAULT '[]',
  l4_evidence_json TEXT NOT NULL DEFAULT '[]',
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('DRAFT','ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interview_job_focus (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  route_id TEXT REFERENCES interview_role_profiles(id),
  question_family_id TEXT REFERENCES interview_question_families(id),
  signal_id TEXT REFERENCES interview_signals(id),
  evidence_ref_id TEXT REFERENCES interview_evidence_refs(id),
  weight INTEGER NOT NULL DEFAULT 0 CHECK(weight BETWEEN -100 AND 100),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((question_family_id IS NOT NULL) + (signal_id IS NOT NULL) + (evidence_ref_id IS NOT NULL) = 1)
);CREATE TABLE interview_sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('REAL','VOICE','MOCK','TEXT')),
  route_id TEXT NOT NULL REFERENCES interview_role_profiles(id),
  scene_id TEXT NOT NULL REFERENCES interview_scene_profiles(id),
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  interviewer_role TEXT,
  difficulty TEXT CHECK(difficulty IS NULL OR difficulty IN ('FOUNDATION','STANDARD','SENIOR','STAFF')),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','FINISHED','ABORTED')),
  strategy_version TEXT NOT NULL,
  corpus_version TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_sessions_route_scene ON interview_sessions(route_id, scene_id, status);
CREATE INDEX ix_interview_sessions_job ON interview_sessions(job_id, status);

CREATE TABLE interview_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL CHECK(turn_index >= 1),
  question_id TEXT REFERENCES interview_questions(id),
  question_family_id TEXT REFERENCES interview_question_families(id),
  turn_intent TEXT NOT NULL CHECK(turn_intent IN ('ASK','FOLLOW_UP','CHALLENGE','CLARIFY','RECOVER','CLOSE_SIGNAL')),
  transcript_ref TEXT,
  answer_summary TEXT,
  selected_evidence_json TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(session_id, turn_index)
);
CREATE INDEX ix_interview_turns_session ON interview_turns(session_id, turn_index);
CREATE TABLE interview_session_signals (
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL REFERENCES interview_signals(id),
  state TEXT NOT NULL CHECK(state IN ('UNTESTED','PROBING','CONFIRMED','WEAKENED','CLOSED')),
  confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  last_turn_id TEXT REFERENCES interview_turns(id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(session_id, signal_id)
);

CREATE TABLE interview_session_hypotheses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','CONFIRMED','REJECTED','SUPERSEDED','CLOSED')),
  source_turn_id TEXT REFERENCES interview_turns(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_hypotheses_session ON interview_session_hypotheses(session_id, status);

CREATE TABLE interview_session_risks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  risk_key TEXT,
  summary TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','FATAL')),
  status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED','REOPENED')),
  last_turn_id TEXT REFERENCES interview_turns(id),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_risks_session ON interview_session_risks(session_id, status, severity);
CREATE TABLE interview_claim_debts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  evidence_ref_id TEXT REFERENCES interview_evidence_refs(id),
  strength TEXT NOT NULL DEFAULT 'NORMAL' CHECK(strength IN ('NORMAL','STRONG')),
  status TEXT NOT NULL CHECK(status IN ('OPEN','PARTIALLY_VERIFIED','VERIFIED','RETRACTED')),
  source_turn_id TEXT REFERENCES interview_turns(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_claim_debts_session ON interview_claim_debts(session_id, status, strength);

CREATE TABLE interview_feedback_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES interview_sessions(id) ON DELETE CASCADE,
  turn_id TEXT REFERENCES interview_turns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('VOICE_SCORE','HUMAN_FEEDBACK','INTERVIEWER_REACTION','REAL_INTERVIEW_OBSERVATION','DEBRIEF')),
  target_type TEXT NOT NULL CHECK(target_type IN ('QUESTION','QUESTION_FAMILY','EVIDENCE','BLUEPRINT','LEARNING','RESUME','SESSION','SIGNAL')),
  target_id TEXT,
  observation TEXT NOT NULL,
  score_suggestion REAL,
  classification TEXT CHECK(classification IS NULL OR classification IN ('A','B','C','D','E','F')),
  created_at TEXT NOT NULL
);
CREATE INDEX ix_interview_feedback_session ON interview_feedback_events(session_id, created_at);

CREATE TABLE interview_training_events (
  id TEXT PRIMARY KEY,
  feedback_event_id TEXT NOT NULL REFERENCES interview_feedback_events(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES interview_sessions(id) ON DELETE CASCADE,
  classification TEXT NOT NULL CHECK(classification IN ('A','B','C','D','E','F')),
  next_action TEXT NOT NULL CHECK(next_action IN ('REINFORCE','BLUEPRINT','ADD_EVIDENCE','LEARNING','TRADEOFF','RESUME')),
  target_ref TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE','DISMISSED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);CREATE TABLE interview_idempotency_requests (
  request_id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  session_id TEXT REFERENCES interview_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('RECEIVED','APPLIED','FAILED','UNKNOWN')),
  response_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_idempotency_session ON interview_idempotency_requests(session_id, operation);

CREATE VIRTUAL TABLE interview_question_search USING fts5(
  item_type UNINDEXED,
  item_id UNINDEXED,
  family_id UNINDEXED,
  text,
  tags,
  signal_terms,
  tokenize='trigram'
);

CREATE INDEX ix_interview_source_documents_source ON interview_source_documents(source_id, lifecycle);
CREATE INDEX ix_interview_scoring_signal ON interview_scoring_anchors(signal_id, polarity);
CREATE INDEX ix_interview_job_focus_job ON interview_job_focus(job_id, weight DESC);
CREATE INDEX ix_interview_blueprints_family ON interview_answer_blueprints(question_family_id, route_id, lifecycle);
INSERT INTO interview_signals(id,name,description,lifecycle,created_at,updated_at) VALUES
('signal.truthfulness','真实性','事实、边界与前后口径是否可信。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.baseline','能力下限','核心岗位能力是否达到稳定可用下限。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.ceiling','能力上限','复杂问题中的技术深度与抽象上限。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.scope','范围','实际承担的问题、系统和影响范围。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.ownership','主导性','本人决策面、责任边界和推进程度。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.judgment','判断力','约束下的方案选择、取舍和复杂度控制。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.failure','失败与纠偏','能否识别错误、接受现实反馈并修正。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.value','价值','技术工作如何连接业务、交付、用户或组织结果。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.transferability','迁移性','过去形成的能力是否可在新环境复现。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('signal.risk','风险','招聘、协作、能力边界和未知风险是否可管理。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z');
INSERT INTO interview_role_profiles(id,name,description,lifecycle,created_at,updated_at) VALUES
('route.ai-agent-devtools','AI Agent / Developer Tools','AI Engineering、Developer Tools、Agent Runtime 与工程可靠性。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('route.tob-fde','ToB / AI 应用交付 / FDE','企业交付、客户问题分解、系统集成与 AI 工程化。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('route.advanced-fe-fullstack','高级前端 / 前端偏全栈','复杂前端、平台工程、Node 与 AI 工程差异化。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z');

INSERT INTO interview_scene_profiles(id,name,interviewer_role,evidence_gate,description,lifecycle,created_at,updated_at) VALUES
('scene.hr','HR / Recruiter','Recruiter','TRUTH_RISK_FIT','真实性、动机、硬约束和交易风险。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.tech1','技术一面','Engineer','FLOOR_BEFORE_CEILING','先验证技术下限与简历真实性。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.deep-dive','项目深挖','Senior / Staff Engineer','OWNERSHIP_JUDGMENT','验证 Scope、Ownership、Judgment、Failure。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.system-design','系统设计','Senior / Staff Engineer','LIVE_JUDGMENT','在新问题上观察约束、边界和 Trade-off。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.coding','Coding / AI Coding','Engineer','ENGINEERING_RUNTIME','观察澄清、实现、验证、修复和 Defense。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.fde-case','FDE / Customer Case','FDE / Business Engineer','DECOMPOSITION_DELIVERY','模糊现实到可验收交付的分解能力。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.hm','Hiring Manager','Hiring Manager','FUTURE_VALUE_RISK','过去证据能否转成未来可复现价值。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.cross','交叉 / 业务 / Culture','Cross-functional Interviewer','COLLABORATION_INTERFACE','跨角色协作与组织接口能力。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.final','终面','Leader','RESIDUAL_RISK','关闭残余风险并维持身份一致。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('scene.offer','Offer / Negotiation','Recruiter / Manager','MUTUAL_DECISION','进入 BATNA、ZOPA、约束与双向决策。','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z');INSERT INTO interview_question_families(id,name,primary_signal_id,normalized_intent,decision_pattern,lifecycle,created_at,updated_at) VALUES
('qf.build-vs-buy','Build vs Buy','signal.judgment','为什么选自研、复用或替代方案。','约束 → 候选方案 → 决策标准 → Trade-off → Evidence','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('qf.ownership','Ownership','signal.ownership','候选人本人到底承担了什么。','问题 → Scope → 决策面 → 协作边界 → Evidence','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('qf.failure-tradeoff','Failure / Trade-off','signal.failure','如何面对错误判断、失败和取舍。','原判断 → 现实反馈 → 根因 → 修正 → 新原则','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z'),
('qf.unknown-boundary','Unknown / Boundary','signal.risk','未知领域下如何管理真实性与系统风险。','Boundary → Known → Inference → Uncertainty → Verification','ACTIVE','2026-09-07T00:00:00.000Z','2026-09-07T00:00:00.000Z');
