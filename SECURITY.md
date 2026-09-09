# Security Policy

## Supported version

Security fixes are applied to the latest `main` branch.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting / Security Advisory flow when available. Do not publish secrets, personal data or exploit details in a public Issue.

Useful reports include:

- affected component and version/commit;
- minimal reproduction using synthetic data;
- expected vs actual security boundary;
- whether the issue can expose local files, credentials or candidate data.

## Sensitive data model

This project intentionally keeps real candidate data outside public Git. The following must never be committed:

- Career Facts containing identifiable personal information;
- resumes and interview recordings;
- recruiter/contact data;
- job-site cookies, tokens, sessions or credentials;
- company-internal performance, Git, issue-tracker or source-code evidence;
- local runtime databases.

Run `npm run verify:public` before publishing changes.
