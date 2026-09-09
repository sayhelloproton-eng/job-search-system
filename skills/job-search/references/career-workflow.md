# Career workflow and truth sources

## Purpose

This reference connects the existing career fact library to job search and application work without creating a duplicate personal profile.

## Canonical sources

Read in this order:

1. `career-assets/职业事实.md`
2. `career-assets/事实治理.md`
3. `career-assets/证据/索引.md`
4. `career-assets/定位/候选人画像.md`
5. Only then read `career-assets/简历/历史/` when historical wording is genuinely useful; history is never a fact source.
6. Read current JD material from runtime SQLite/current search results, not archived legacy JD ledgers.

Career Facts owns verified candidate truth; Evidence owns proof and limits; Candidate Profile is a derived positioning layer. The job-search skill owns selection, comparison, drafting, ranking, and application workflow only.

## Fact discipline

- A JD requirement is market evidence, not candidate evidence.
- A skill mentioned in a job title or posting must never be copied into the resume unless supported by candidate facts.
- Preserve ownership boundaries, evidence confidence, and sensitive-level restrictions from the fact library.
- Never silently upgrade self-assessment, historical wording, or inferred capability into verified production experience.
- When facts conflict, surface the conflict; do not choose the more attractive version.
## Working outputs

Do not create a placeholder application workspace in Phase 1. Current job/search state belongs in SQLite; durable resume assets belong under `career-assets/简历/`.

The later application/write phase must define its own persistent output/workspace contract through SDD before introducing a new directory or tracker. Do not invent one from this Skill reference.

## Lifecycle

Use these states consistently:

`DISCOVERED → SHORTLISTED → PREPARED → APPROVED → SUBMITTED → INTERVIEW / REJECTED / OFFER / CLOSED`

Use `UNKNOWN` when an external write may have occurred but cannot be verified. Never convert `UNKNOWN` to `SUBMITTED` by guessing or retrying.

## Minimal tracking record

A tracker record should contain: timestamp, source, stable job identifier or URL, company, role, fit score/confidence, resume path/version, greeting status, application state, submission evidence summary, and notes. Never store Cookie/token/security identifiers.
