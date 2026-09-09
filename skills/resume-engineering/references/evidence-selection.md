# Evidence selection

Select evidence only after the JD requirement model exists.

## Evidence relation

For every important requirement, assign one relation:

- `SUPPORTED`: direct production/project evidence for substantially the same capability.
- `PARTIAL`: direct evidence exists, but scope/technology/seniority is narrower than the JD.
- `TRANSFERABLE`: the underlying engineering problem is proven in another technology/domain.
- `GAP`: no defensible evidence.

Do not convert `PARTIAL` or `TRANSFERABLE` into `SUPPORTED` by changing wording.

## Selection hierarchy

Prefer, in order:

1. direct, recent, independently traceable evidence;
2. direct older evidence when it is more relevant or stronger;
3. transferable evidence with a clear mechanism-level connection;
4. adjacent evidence only when it adds a useful secondary signal.

Recency alone does not outrank relevance and proof strength.

## Project selection

A project belongs in the resume when it proves one or more high-value requirements better than competing material.

For each candidate project ask:

- What problem was solved?
- What did the candidate personally decide/implement/own?
- What mechanism demonstrates technical depth?
- What changed afterward?
- What is the evidence boundary?
- Can the candidate explain it naturally in interview?

Personal projects are allowed when real, substantial, and target-relevant. Label them as personal/independent projects rather than implying employer production use.

## Metrics

Only use metrics already supported and explainable. Never estimate missing ROI, latency, adoption, user counts, team size, revenue, or efficiency.

If a metric is unsafe or unavailable, use verified alternatives:

- system/component scope;
- number/type of environments or integration boundaries;
- architecture complexity;
- migration or compatibility scope;
- test/quality maturity;
- reusable capability introduced;
- observed delivery/adoption state.

## Internal matrix

Maintain a private row for every substantive public bullet:

`JD requirement | fact/evidence | relation | ownership | metric/scope | wording boundary | confidence | selected variant(s)`

The public resume must not expose internal IDs or local paths.
