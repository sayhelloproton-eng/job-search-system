# Codex Chrome evidence for BOSS

## Important conclusion

Codex Chrome has one confirmed successful BOSS content-read case and several confirmed unstable cases. Preserve both facts.

## Confirmed success

On the BOSS resume page, the following Chrome sequence succeeded:

```text
claimTab → domSnapshot → finalize(handoff)
```

- DOM length: about `8798` characters.
- User-visible outcome: page remained normal and did not refresh.
- No navigation, click, scroll, screenshot, extra wait, or repeated DOM read was included.

This is the current BOSS-specific success pattern. It is evidence of capability, not a universal stability guarantee.

## Confirmed failures and anomalies

1. `domSnapshot + deliverable` returned DOM but the page became blank in one test.
2. A full-page screenshot failed with `Cannot access a chrome:// URL`; the user saw two refreshes and then a blank page.
3. A jobs-page DOM read followed by `keep: []` timed out at CDP `Runtime.evaluate`; the user saw back navigation.
4. Repeating the jobs-page DOM read with `handoff` still timed out at `Runtime.evaluate`. This shows that `handoff` is not sufficient to guarantee DOM success.
5. Repeated `goto()` calls caused visible reload and redirect cycles.

## Operational interpretation

- The success case proves Chrome can obtain BOSS content.
- The failures prove the route is fragile and page-specific.
- Use the exact success sequence for a single authorized read, but stop on the first anomaly.
- Never claim a single low-level cause without an isolated test. Record correlation separately from causation.
- Do not use screenshots on the BOSS resume page under the current evidence.
- Do not use Chrome to compensate for a successful CLI search unless the user explicitly requests website comparison.

## Generic API versus BOSS evidence

Generic Chrome documentation says claimed user tabs can be omitted from `keep` and remain open. BOSS field evidence showed back navigation after `keep: []`, while the confirmed successful content read ended with `handoff`. For BOSS, preserve the site-specific successful lifecycle unless a newly authorized isolated experiment proves otherwise.

## Archived provenance — do not read

This reference already contains the required facts. Do not open the archived source documents during skill use:
