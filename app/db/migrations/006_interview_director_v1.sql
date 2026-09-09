PRAGMA foreign_keys = ON;

CREATE TABLE interview_director_session_plans (
  session_id TEXT PRIMARY KEY REFERENCES interview_sessions(id) ON DELETE CASCADE,
  plan_version TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interview_director_decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  source_turn_id TEXT NOT NULL REFERENCES interview_turns(id) ON DELETE CASCADE,
  phase_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('PROBE_DEPTH','CHALLENGE_TRADEOFF','CROSS_CHECK_CLAIM','CLARIFY','PIVOT_TOPIC','ADVANCE_PHASE','CLOSE_ROUND','RECOVER')),
  target_signal_id TEXT REFERENCES interview_signals(id),
  preferred_family_id TEXT REFERENCES interview_question_families(id),
  hypothesis_id TEXT REFERENCES interview_session_hypotheses(id),
  claim_debt_id TEXT REFERENCES interview_claim_debts(id),
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  elapsed_seconds INTEGER NOT NULL CHECK(elapsed_seconds >= 0),
  remaining_seconds INTEGER NOT NULL CHECK(remaining_seconds >= 0),
  next_phase_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, source_turn_id)
);
CREATE INDEX ix_interview_director_decisions_session ON interview_director_decisions(session_id, created_at, id);

CREATE TABLE interview_round_scorecards (
  session_id TEXT PRIMARY KEY REFERENCES interview_sessions(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK(verdict IN ('HIRE_SIGNAL','MIXED','NO_HIRE_SIGNAL','INSUFFICIENT')),
  scorecard_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER interview_director_plan_no_update BEFORE UPDATE ON interview_director_session_plans BEGIN SELECT RAISE(ABORT,'DIRECTOR_PLAN_APPEND_ONLY'); END;
CREATE TRIGGER interview_director_plan_no_delete BEFORE DELETE ON interview_director_session_plans BEGIN SELECT RAISE(ABORT,'DIRECTOR_PLAN_APPEND_ONLY'); END;
CREATE TRIGGER interview_director_decision_no_update BEFORE UPDATE ON interview_director_decisions BEGIN SELECT RAISE(ABORT,'DIRECTOR_DECISION_APPEND_ONLY'); END;
CREATE TRIGGER interview_director_decision_no_delete BEFORE DELETE ON interview_director_decisions BEGIN SELECT RAISE(ABORT,'DIRECTOR_DECISION_APPEND_ONLY'); END;
CREATE TRIGGER interview_round_scorecard_no_update BEFORE UPDATE ON interview_round_scorecards BEGIN SELECT RAISE(ABORT,'DIRECTOR_SCORECARD_FINAL'); END;
CREATE TRIGGER interview_round_scorecard_no_delete BEFORE DELETE ON interview_round_scorecards BEGIN SELECT RAISE(ABORT,'DIRECTOR_SCORECARD_FINAL'); END;
