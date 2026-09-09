import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testsDir = resolve('app/tests');
const tests = readdirSync(testsDir)
  .filter((name) => name.endsWith('.public.test.ts'))
  .sort()
  .map((name) => resolve(testsDir, name));

if (!tests.length) {
  console.error('No public tests found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...tests], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
