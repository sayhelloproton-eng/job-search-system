PRAGMA foreign_keys = ON;

CREATE TABLE learning_course_progress (
  course_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('UNSEEN','RECOGNIZE','EXPLAIN','CONNECT','APPLY','DEBUG','DESIGN','INTERVIEW_READY')),
  confidence REAL NOT NULL DEFAULT 0 CHECK(confidence >= 0 AND confidence <= 1),
  source_type TEXT NOT NULL,
  source_ref TEXT,
  next_review_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE learning_course_progress_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  course_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  note TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  next_review_at TEXT,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX ix_learning_course_progress_review
  ON learning_course_progress(next_review_at, state);
CREATE INDEX ix_learning_course_progress_events_course
  ON learning_course_progress_events(course_id, created_at, id);

CREATE TRIGGER learning_course_progress_event_no_update
BEFORE UPDATE ON learning_course_progress_events
BEGIN
  SELECT RAISE(ABORT,'LEARNING_COURSE_PROGRESS_EVENT_APPEND_ONLY');
END;

CREATE TRIGGER learning_course_progress_event_no_delete
BEFORE DELETE ON learning_course_progress_events
BEGIN
  SELECT RAISE(ABORT,'LEARNING_COURSE_PROGRESS_EVENT_APPEND_ONLY');
END;
