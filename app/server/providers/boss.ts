import { spawn } from 'node:child_process';

export const BOSS_PHASE1_CONTROL_MODE = 'boss-agent-cli';
export const BOSS_EXTERNAL_BROWSER_FALLBACK = false;
export const BOSS_PHASE1_READ_ONLY = true;
export const BOSS_PHASE1_CAPABILITIES = ['discovery', 'detail', 'verification'] as const;

const SECRET_KEYS = new Set([
  'cookie', 'cookies', 'token', 'accesstoken', 'refreshtoken',
  'securityid', 'security_id', 'captcha', 'captchasolution',
  'authorization', 'password', 'session', 'sessionid'
]);

function normalizedKey(key: string) {
  return key.replace(/[-_]/g, '').toLowerCase();
}

export function sanitizeBossObservation(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeBossObservation);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key.toLowerCase()) || SECRET_KEYS.has(normalizedKey(key))) continue;
    output[key] = sanitizeBossObservation(child);
  }
  return output;
}
export function buildBossSearchCommand(
  query: string,
  options: { city?: string; page?: number } = {}
) {
  const city = options.city ?? '上海';
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  return {
    file: 'boss',
    args: ['search', query, '--city', city, '--page', String(page), '--no-cache'],
    shell: false as const
  };
}

export function buildBossDetailCommand(securityId: string, jobId?: string) {
  return {
    file: 'boss',
    args: jobId ? ['detail', securityId, '--job-id', jobId] : ['detail', securityId],
    shell: false as const
  };
}

type CliRunOptions = {
  executable?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
};

function cliError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}
export async function runBossCliJson(args: string[], options: CliRunOptions = {}) {
  const executable = options.executable ?? 'boss';
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputBytes = options.maxOutputBytes ?? 2_000_000;

  return await new Promise<any>((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finishReject(cliError('CLI_TIMEOUT', `boss CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const append = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') > maxOutputBytes) {
        child.kill('SIGTERM');
        finishReject(cliError('CLI_OUTPUT_TOO_LARGE', 'boss CLI output exceeded limit'));
        return current;
      }
      return next;
    };

    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on('error', () => {
      clearTimeout(timer);
      finishReject(cliError('CLI_PROCESS_FAILED', 'boss CLI process failed to start'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        return finishReject(cliError('CLI_PROCESS_FAILED', stderr.trim() || `boss CLI exited ${code}`));
      }
      try {
        const text = stdout.trim();
        const parsed = JSON.parse(text);
        settled = true;
        resolve(parsed);
      } catch {
        finishReject(cliError('CLI_INVALID_JSON', 'boss CLI returned invalid JSON'));
      }
    });
  });
}
function firstDefined(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

export function normalizeBossSearchPayload(payload: any) {
  const safe = sanitizeBossObservation(payload ?? {});
  const jobs = Array.isArray(payload?.data) ? payload.data.map((row: any) => {
    const job: Record<string, any> = {
      externalJobId: row.job_id,
      title: row.title,
      company: row.company,
      salaryText: row.salary,
      city: row.city,
      district: row.district,
      experience: row.experience,
      education: row.education,
      recruiterName: row.boss_name,
      recruiterTitle: row.boss_title,
      recruiterActivity: row.boss_active
    };
    const publishedAt = firstDefined(row.published_at, row.publish_time, row.job_pub_time, row.create_time);
    const sourceUrl = firstDefined(row.source_url, row.job_url, row.url);
    if (publishedAt !== undefined) job.publishedAt = publishedAt;
    if (sourceUrl !== undefined) job.sourceUrl = sourceUrl;
    return sanitizeBossObservation(job);
  }) : [];

  return {
    jobs,
    pagination: {
      page: safe?.pagination?.page ?? 1,
      hasMore: Boolean(safe?.pagination?.has_more),
      total: safe?.pagination?.total ?? jobs.length
    }
  };
}
export function normalizeBossDetailPayload(payload: any) {
  const safe = sanitizeBossObservation(payload ?? {});
  const row = safe?.data && !Array.isArray(safe.data) ? safe.data : safe;
  const detail: Record<string, any> = {
    externalJobId: firstDefined(row?.job_id, row?.jobId),
    title: row?.title,
    company: row?.company,
    salaryText: firstDefined(row?.salary, row?.salary_text),
    city: row?.city,
    district: row?.district,
    address: firstDefined(row?.address, row?.job_address),
    experience: firstDefined(row?.experience, row?.experience_text),
    education: firstDefined(row?.education, row?.education_text),
    jdText: firstDefined(row?.description, row?.jd_text, row?.job_description),
    recruiterName: firstDefined(row?.boss_name, row?.recruiter_name),
    recruiterTitle: firstDefined(row?.boss_title, row?.recruiter_title),
    recruiterActivity: firstDefined(row?.boss_active, row?.recruiter_activity)
  };
  const sourceUrl = firstDefined(row?.source_url, row?.job_url, row?.url);
  if (sourceUrl !== undefined) detail.sourceUrl = sourceUrl;
  return sanitizeBossObservation(detail);
}

export function filterBossDiscovery(items: any[], now = new Date()) {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 2);
  const accepted: any[] = [];
  const blocked: Array<{ item: any; reason: string }> = [];
  const rejected: Array<{ id: any; reason: string }> = [];

  for (const item of items) {
    if (item.city !== '上海' && item.city !== '上海市') {
      rejected.push({ id: item.id, reason: 'OUTSIDE_SHANGHAI' });
      continue;
    }
    if (!item.publishedAt) {
      if (item.externalJobId || item.id || item.sourceUrl) {
        accepted.push(sanitizeBossObservation({ ...item, publishedAt: null }));
      } else {
        blocked.push({ item: sanitizeBossObservation(item), reason: 'SOURCE_IDENTITY_MISSING' });
      }
      continue;
    }
    const publishedAt = new Date(item.publishedAt);
    if (!Number.isFinite(publishedAt.getTime())) {
      if (item.externalJobId || item.id || item.sourceUrl) {
        accepted.push(sanitizeBossObservation({ ...item, publishedAt: null }));
      } else {
        blocked.push({ item: sanitizeBossObservation(item), reason: 'SOURCE_IDENTITY_MISSING' });
      }
      continue;
    }
    if (publishedAt < cutoff || publishedAt > now) {
      rejected.push({ id: item.id, reason: 'OUTSIDE_PUBLISH_WINDOW' });
      continue;
    }
    accepted.push(sanitizeBossObservation(item));
  }
  return { accepted, blocked, rejected };
}
