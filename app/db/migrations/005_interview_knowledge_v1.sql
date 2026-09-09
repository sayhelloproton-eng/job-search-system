PRAGMA foreign_keys = ON;

CREATE TABLE interview_knowledge_topics (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_knowledge_topics_domain ON interview_knowledge_topics(domain_id,lifecycle);

CREATE TABLE interview_family_topic_links (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES interview_knowledge_topics(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK(relation_type IN ('PRIMARY','SUPPORTING')),
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(question_family_id,topic_id)
);
CREATE INDEX ix_interview_family_topic_topic ON interview_family_topic_links(topic_id,lifecycle);

CREATE TABLE interview_topic_route_expectations (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES interview_knowledge_topics(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES interview_role_profiles(id) ON DELETE CASCADE,
  expectation TEXT NOT NULL CHECK(expectation IN ('CORE','IMPORTANT','OPTIONAL')),
  rationale TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(topic_id,route_id)
);
CREATE INDEX ix_interview_topic_route_route ON interview_topic_route_expectations(route_id,expectation,lifecycle);

CREATE TABLE interview_family_source_links (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  source_unit_id TEXT NOT NULL REFERENCES interview_source_units(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK(relation_type IN ('METHOD_SUPPORT','QUESTION_SOURCE','MARKET_VALIDATION')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  note TEXT,
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle IN ('ACTIVE','DEPRECATED','REPLACED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(question_family_id,source_unit_id,relation_type)
);
CREATE INDEX ix_interview_family_source_family ON interview_family_source_links(question_family_id,relation_type);
