PRAGMA foreign_keys = ON;

CREATE TABLE interview_round_debriefs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  verdict TEXT NOT NULL CHECK(verdict IN ('PASS','PARTIAL','FAIL','UNSCORED')),
  score_value REAL CHECK(score_value IS NULL OR (score_value >= 0 AND score_value <= 100)),
  score_reason TEXT NOT NULL,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  weaknesses_json TEXT NOT NULL DEFAULT '[]',
  interviewer_intent_json TEXT NOT NULL DEFAULT '[]',
  sentence_critiques_json TEXT NOT NULL DEFAULT '[]',
  replacement_examples_json TEXT NOT NULL DEFAULT '[]',
  knowledge_gaps_json TEXT NOT NULL DEFAULT '[]',
  expression_gaps_json TEXT NOT NULL DEFAULT '[]',
  next_training_plan_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE(session_id, revision)
);
CREATE INDEX ix_interview_round_debriefs_session ON interview_round_debriefs(session_id, revision DESC);
CREATE TABLE interview_answer_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  turn_id TEXT REFERENCES interview_turns(id) ON DELETE SET NULL,
  question_family_id TEXT REFERENCES interview_question_families(id),
  parent_version_id TEXT REFERENCES interview_answer_versions(id),
  version_kind TEXT NOT NULL CHECK(version_kind IN ('ORIGINAL','REVIEWED','IMPROVED','LATER_PRACTICE')),
  content TEXT NOT NULL,
  critique_summary TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_interview_answer_versions_family ON interview_answer_versions(question_family_id, created_at);
CREATE INDEX ix_interview_answer_versions_session ON interview_answer_versions(session_id, created_at);

CREATE TRIGGER trg_interview_answer_versions_no_update
BEFORE UPDATE ON interview_answer_versions
BEGIN
  SELECT RAISE(ABORT, 'INTERVIEW_ANSWER_VERSION_IMMUTABLE');
END;
CREATE TABLE interview_growth_items (
  id TEXT PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL CHECK(item_type IN ('WEAKNESS','KNOWLEDGE_GAP','EXPRESSION_GAP')),
  dimension_type TEXT NOT NULL CHECK(dimension_type IN ('QUESTION_FAMILY','SIGNAL','TOPIC','PROJECT','EXPRESSION','GENERAL')),
  dimension_ref TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IMPROVING','STABLE','REGRESSING','RESOLVED')),
  occurrence_count INTEGER NOT NULL DEFAULT 0 CHECK(occurrence_count >= 0),
  practice_count INTEGER NOT NULL DEFAULT 0 CHECK(practice_count >= 0),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_growth_items_status ON interview_growth_items(status, item_type, severity);
CREATE INDEX ix_interview_growth_items_dimension ON interview_growth_items(dimension_type, dimension_ref);
CREATE TABLE interview_growth_observations (
  id TEXT PRIMARY KEY,
  growth_item_id TEXT NOT NULL REFERENCES interview_growth_items(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES interview_sessions(id) ON DELETE SET NULL,
  turn_id TEXT REFERENCES interview_turns(id) ON DELETE SET NULL,
  observation_type TEXT NOT NULL CHECK(observation_type IN ('OCCURRENCE','PRACTICE','IMPROVEMENT','REGRESSION','RESOLUTION','NOTE')),
  evidence_text TEXT NOT NULL,
  score_value REAL CHECK(score_value IS NULL OR (score_value >= 0 AND score_value <= 100)),
  created_at TEXT NOT NULL
);
CREATE INDEX ix_interview_growth_observations_item ON interview_growth_observations(growth_item_id, created_at);

CREATE TABLE interview_best_answer_candidates (
  id TEXT PRIMARY KEY,
  question_family_id TEXT NOT NULL REFERENCES interview_question_families(id) ON DELETE CASCADE,
  route_id TEXT REFERENCES interview_role_profiles(id),
  answer_version_id TEXT NOT NULL REFERENCES interview_answer_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('CANDIDATE','CURRENT','RETIRED')),
  selection_reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_interview_best_answer_current ON interview_best_answer_candidates(question_family_id, COALESCE(route_id,'')) WHERE status='CURRENT';
CREATE TABLE interview_review_queue (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('GROWTH_ITEM','ANSWER_VERSION','QUESTION_FAMILY','TOPIC','PROJECT')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN -100 AND 100),
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE','SNOOZED','DISMISSED')),
  source_session_id TEXT REFERENCES interview_sessions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_interview_review_queue_open ON interview_review_queue(status, due_at, priority DESC);
