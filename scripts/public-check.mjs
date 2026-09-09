import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const forbiddenPrefixes = [
  'career-assets/',
  '.private/',
  'docs/00-公共上下文/',
  'docs/面试/社交媒体素材清洗/',
  'app/db/runtime/',
  'skills/resume-engineering/templates/',
];

const textExtensions = new Set([
  '', '.md', '.txt', '.ts', '.js', '.mjs', '.json', '.jsonl', '.yml', '.yaml',
  '.html', '.css', '.sh', '.sql', '.csv', '.py',
]);

const contentRules = [
  ['macOS home path', /\/Users\/[^/\s]+(?:\/|$)/],
  ['Windows home path', /[A-Za-z]:\\Users\\[^\\\s]+(?:\\|$)/],
  ['phone-like PII', /(?<!\d)1[3-9]\d{9}(?!\d)/],
  ['email-like PII', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._~+\/=-]{20,}\b/i],
  ['credential in URL', /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
];

const privateKeyRule = new RegExp(
  ['-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY-----'].join(''),
);

const localDenylistPath = '.private/public-denylist.txt';
const localTerms = existsSync(localDenylistPath)
  ? readFileSync(localDenylistPath, 'utf8').split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  : [];

const failures = [];
for (const path of tracked) {
  for (const prefix of forbiddenPrefixes) {
    if (path.startsWith(prefix)) failures.push(`${path}: forbidden tracked prefix ${prefix}`);
  }
  if (!textExtensions.has(extname(path).toLowerCase())) continue;
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { continue; }
  for (const [name, rule] of contentRules) {
    if (rule.test(text)) failures.push(`${path}: ${name}`);
  }
  if (privateKeyRule.test(text)) failures.push(`${path}: private key material`);
  for (const term of localTerms) {
    if (text.includes(term)) failures.push(`${path}: local private denylist match`);
  }
}

if (failures.length) {
  console.error('PUBLIC_CHECK_FAILED');
  for (const failure of [...new Set(failures)].sort()) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PUBLIC_CHECK_PASS tracked=${tracked.length} localDenylist=${localTerms.length}`);
