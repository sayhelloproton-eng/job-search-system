# JD evaluation and ranking

## Goal

Decide whether a role is worth the candidate's time using the exact JD plus verified Career Facts/Evidence. This is an evidence-backed decision layer, not an offer-probability model.

Keep two scores distinct:

- `rule_score`: deterministic runtime keyword/baseline triage from the Phase 1 app.
- `evidence_fit_score`: this Agent evaluation against the complete JD and candidate evidence.

Never merge or average them.

## Step 1 — model requirements before scoring

Extract each meaningful JD requirement and annotate both dimensions:

- importance: `CRITICAL / MUST / PREFERRED / CONTEXT`;
- basis: `EXPLICIT / STRUCTURAL / INFERRED`.

`EXPLICIT` means the posting states it. `STRUCTURAL` means repeated responsibilities/positioning make it materially necessary. `INFERRED` is an analyst hypothesis and must stay visibly lower-confidence; it cannot be restated as a written requirement.

For each requirement capture: text, category, importance, basis, candidate relation (`SUPPORTED / PARTIAL / TRANSFERABLE / GAP`), CF/EV source, ownership boundary, and confidence.

## Step 2 — hard gates

Check location/commute, job type/seniority, explicitly mandatory education/certification, non-negotiable years/domain requirements, language/work authorization, compensation floor if known, and user-defined exclusions.

Classify each `PASS / RISK / BLOCK / UNKNOWN`. A real `BLOCK` can veto application regardless of technical fit. Education text follows repository SDD risk semantics and is not automatically a hard block.

## Step 3 — posting legitimacy is a separate axis

Do not let role fit, company prestige, salary, or AI wording change recruiting legitimacy. Consume only Provider observation and `job_verifications`. Report the current verification status (`NEW / LISTED / LIVE_CONFIRMED / RECRUITER_CONFIRMED / UNKNOWN / BLOCKED / STALE / CLOSED`) plus evidence freshness.

`BLOCKED != CLOSED`. A high-fit job with stale/blocked legitimacy requires verification, not a higher fit score. A live job with poor fit remains a poor fit.

## Step 4 — evidence-backed fit score

Use 100 points as a prioritization aid:

| Dimension | Weight |
|---|---:|
| Core role / responsibility alignment | 25 |
| Critical + must-have technical requirements with evidence | 25 |
| Relevant project / domain evidence | 20 |
| Seniority, ownership, system/design and delivery scope | 15 |
| Career-direction value / transferability | 10 |
| Practical attractiveness not covered by gates | 5 |

Critical/MUST gaps must remain visible even if other dimensions compensate numerically. Prefer explicit/structural requirements when allocating points; inferred requirements may explain a judgment but should not materially inflate the score.

## Step 5 — confidence and recommendation

Confidence: `HIGH` for a complete/current JD plus direct evidence across core requirements; `MEDIUM` for material indirect/partial evidence; `LOW` for partial/stale JD or major ambiguity.

Default bands, subject to hard gates and legitimacy:

- `85–100 STRONG_APPLY`
- `70–84 APPLY`
- `55–69 SELECTIVE`
- `<55 SKIP`

A low-confidence 90 must not silently outrank a high-confidence 85. `BLOCK` overrides the band; stale/blocked legitimacy lowers action readiness even when fit is strong.

## Required human report

1. Recommendation / evidence-fit score / confidence.
2. Posting legitimacy and evidence freshness.
3. Hard gates/blockers.
4. Top requirements with importance + basis.
5. Top 3 evidence-backed strengths.
6. Top 3 gaps/uncertainties, especially CRITICAL/MUST gaps.
7. Closest resume baseline and bounded tailoring strategy.
8. Application/clarification strategy and next useful action.

## Required machine summary

When an evaluation is persisted as an experiment/report, keep stable fields for later comparison:

`provider`, `job_id`, `company`, `role`, `role_cluster`, `evaluation_version`, `evaluated_at`, `evidence_fit_score`, `confidence`, `recommendation`, `legitimacy_status`, `hard_gates`, `critical_requirements`, `strengths`, `gaps`, `resume_base`, `next_action`.

Do not persist provider secrets. Outcomes can later recalibrate search/tailoring strategy, but never rewrite Career Facts by themselves.
