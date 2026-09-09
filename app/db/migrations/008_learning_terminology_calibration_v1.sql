PRAGMA foreign_keys = ON;

CREATE TABLE learning_term_candidates (
  id TEXT PRIMARY KEY,
  normalized_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('OPEN','READY_FOR_CURATED_REVIEW','ACCEPTED','REJECTED','MERGED')),
  mention_count INTEGER NOT NULL DEFAULT 0 CHECK(mention_count >= 0),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX ix_learning_term_candidates_status ON learning_term_candidates(status,last_seen_at);

CREATE TABLE learning_term_candidate_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  candidate_id TEXT NOT NULL REFERENCES learning_term_candidates(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  context TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_learning_term_candidate_events_candidate ON learning_term_candidate_events(candidate_id,created_at,id);
CREATE TABLE learning_term_calibration_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  term_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('CONFIRMED','UPDATE_REQUIRED','DEPRECATED','ALIAS_CHANGE','RELATION_CHANGE')),
  source_ref TEXT NOT NULL,
  source_version TEXT,
  note TEXT NOT NULL,
  response_json TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);
CREATE INDEX ix_learning_term_calibration_term ON learning_term_calibration_events(term_id,reviewed_at,id);

CREATE TRIGGER learning_term_candidate_event_no_update BEFORE UPDATE ON learning_term_candidate_events
BEGIN SELECT RAISE(ABORT,'CANDIDATE_EVENT_APPEND_ONLY'); END;
CREATE TRIGGER learning_term_candidate_event_no_delete BEFORE DELETE ON learning_term_candidate_events
BEGIN SELECT RAISE(ABORT,'CANDIDATE_EVENT_APPEND_ONLY'); END;
CREATE TRIGGER learning_term_calibration_no_update BEFORE UPDATE ON learning_term_calibration_events
BEGIN SELECT RAISE(ABORT,'CALIBRATION_EVENT_APPEND_ONLY'); END;
CREATE TRIGGER learning_term_calibration_no_delete BEFORE DELETE ON learning_term_calibration_events
BEGIN SELECT RAISE(ABORT,'CALIBRATION_EVENT_APPEND_ONLY'); END;
