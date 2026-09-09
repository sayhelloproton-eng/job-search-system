# Contributing

Thanks for helping improve Job Search System.

## Before opening a change

1. Keep the project local-first and privacy-first.
2. Do not add real candidate data, recruiter data, cookies, tokens, resumes, employer-internal material or proprietary source.
3. Use synthetic fixtures for tests and documentation.
4. Do not turn learning outcomes into career facts automatically.
5. External side effects must remain explicit and user-authorized.

## Development

```bash
npm test
npm run verify:public
```

For a feature or fix, include a focused test that proves the intended behavior.

## Pull requests

A PR should explain:

- the problem;
- the chosen boundary / design;
- the verification performed;
- whether it changes data contracts, privacy behavior or external side effects.

Keep unrelated refactors out of the same PR.

## Private data

Never attach real CVs, phone numbers, emails, recruiter conversations, job-site sessions, performance reviews or internal company files to an Issue or PR.
