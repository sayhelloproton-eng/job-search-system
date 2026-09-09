# Resume variant generation

Use this only when the user wants multiple candidates, role-cluster baselines, or an experiment.

## Principle

Variants must test different resume strategies. They are not synonym shuffles.

For each target role cluster, generate up to six first-generation candidates:

1. `SCAN` — recruiter-scan-first: strongest fit and proof immediately visible.
2. `TECH` — technical-depth-first: architecture, mechanisms, trade-offs, system boundaries.
3. `OWN` — ownership/impact-first: decisions, responsibility, delivery consequences, leverage.
4. `PROJ` — project-first: flagship projects define the narrative.
5. `SAFE` — conservative-scan-first: simple structure, clear chronology, and strongest truthful JD terminology overlap.
6. `BAL` — balanced: deliberate compromise across scanability, depth, evidence, and density.

Skip a family when the target does not justify it.

## What may vary

- opening positioning language;
- selected proof pillars;
- project selection and order;
- bullet allocation by experience/project;
- amount of implementation detail;
- whether a strong personal project is included;
- skills grouping and order;
- compression of older experience;
- summary length and emphasis.

## What must not vary

- factual employers, formal titles, dates, education, project ownership, or evidence boundaries;
- metric meanings;
- whether a gap exists;
- unsupported technologies or experience;
- sensitive/public naming rules.

## Candidate manifest

Each candidate gets a private manifest:

```yaml
candidate_id: <cluster>-<family>-G1
hypothesis: <what this version is testing>
target_cluster: <cluster>
selected_evidence: [...]
omitted_high_value_evidence: [...]
major_jd_coverage: [...]
known_gaps: [...]
review_score: null
human_score: null
human_comments: null
```

The public resume does not contain this manifest.

## Generation 2

After human scoring, keep the top 2 candidates per cluster. For each winner, create 2–3 mutations that preserve the winning strategy while testing one controlled change, for example:

- stronger first-screen summary;
- different flagship project mix;
- tighter technical detail;
- more aggressive compression of older work;
- a more natural/human bullet style.

Do not mutate five dimensions at once; otherwise the score cannot teach us what improved.

## Stop condition

Stop when one or two strategies per cluster clearly dominate human scores and additional mutations no longer improve quality meaningfully. The goal is not infinite resume generation; it is evidence-driven convergence on a small set of strong baselines.
