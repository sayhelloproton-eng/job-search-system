# Browser application and greeting workflow

## Responsibility split

Keep search and browser writes separate:

```text
provider adapters → read-only job search/detail
real Chrome executor → page navigation, form preparation, greeting/application actions
```

For BOSS specifically, discovery/detail remains `boss-agent-cli` first. The dedicated no-`chrome.debugger` Chrome Extension is reserved for the later application/write stage; do not promote it into the normal search path.

Never use a provider adapter's native apply, greet, chat, exchange, or bulk-write commands as a shortcut.

## Browser executor

For BOSS, the preferred write executor is the dedicated no-`chrome.debugger` Chrome Extension path after it has passed its own application-stage acceptance; Playwright/CDP is not the normal BOSS write path because BOSS-specific debugger instability has been reproduced. For other providers, prefer a connected Playwright Chrome MCP/runtime when provider evidence permits it. If the selected executor is unavailable, do not silently start a second browser, independent profile, CDP/Patchright fallback, or other automation runtime for write actions.

Use the exact target tab/job. Re-check visible company, role, and target URL/identifier before preparing any outgoing content.

## Two approval gates

### Gate A — prepare

Before browser interaction, show the user:

- company + role;
- fit recommendation and important gaps;
- exact resume/version to use;
- exact greeting or intro text;
- any non-obvious form answers;
- intended browser actions.

User approval at Gate A permits reversible preparation only: open target, inspect required fields, fill drafts, select the approved resume, and stage the action.
### Gate B — irreversible send/submit

Immediately before clicking the final action (`发送`, `打招呼`, `立即沟通`, `投递`, `提交`, or equivalent), show the final target and outgoing content again and require explicit approval for that specific job.

Do not treat earlier permission to “help me apply” as blanket approval for multiple irreversible actions. Do not reuse approval from another job.

## Execution rules

1. Use the user's existing logged-in real Chrome only.
2. Keep one job/application active at a time; no parallel browser submissions.
3. Do not read or export cookies, localStorage, passwords, verification codes, unrelated tabs, or hidden auth values.
4. Do not use random delays, stealth/anti-detection tricks, synthetic account activity, or background loops.
5. Stop at CAPTCHA, risk warnings, unexpected redirects, login changes, rate limits, or any UI state that makes the target ambiguous.
6. Never automatically retry an irreversible action after timeout or tool failure.
7. If a page requires information not supported by verified facts, ask the user rather than inventing an answer.
8. Do not upload a resume different from the one approved in the application package.

## Post-submit verification

After the final action, perform at most one bounded verification using the visible page state. Record one of:

- `SUBMITTED_CONFIRMED` — visible success/received state clearly belongs to the intended job.
- `NOT_SUBMITTED` — page clearly shows the action did not occur.
- `UNKNOWN` — tool timed out, page changed unexpectedly, or success cannot be established.

For `UNKNOWN`, stop. Do not click again, refresh repeatedly, switch tools, or assume success/failure.

## Provider greeting / first-contact message

Treat any platform greeting, first-contact message, or communication action as an external write even when it does not attach a resume. Generate a short job-specific message from verified facts, show it before use, and require Gate B approval before sending.

The purpose is targeted communication, not maximizing message volume. No batch greeting or autonomous follow-up.
