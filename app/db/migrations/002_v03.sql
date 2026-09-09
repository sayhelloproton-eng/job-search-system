ALTER TABLE jobs
ADD COLUMN recruiter_recently_active INTEGER
CHECK (
  recruiter_recently_active IS NULL
  OR recruiter_recently_active IN (0, 1)
);

CREATE INDEX IF NOT EXISTS ix_jobs_published_district
ON jobs(published_at DESC, district);
