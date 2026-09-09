import { createHash, randomUUID } from 'node:crypto';
import { classifyEducationRisk, evaluateMatch } from './domain.ts';
import { buildBossDetailCommand, buildBossSearchCommand, filterBossDiscovery, normalizeBossDetailPayload, normalizeBossSearchPayload, runBossCliJson, sanitizeBossObservation } from './providers/boss.ts';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizedText = (value: any) => String(value ?? '').trim().replace(/\s+/g, ' ');

function cleanSourceUrl(value: any) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function identityFingerprint(job: any) {
  if (job.externalJobId) return sha256(`boss|external|${job.externalJobId}`);
  const sourceUrl = cleanSourceUrl(job.sourceUrl);
  if (sourceUrl) return sha256(`boss|url|${sourceUrl}`);
  return sha256(['boss', job.company, job.title, job.city, job.district].map(normalizedText).join('|'));
}
function educationRiskReason(text: any, risk: string) {
  const source = normalizedText(text);
  if (!source) return '学历要求未明确';
  if (risk === 'VERY_HIGH') return `高学位要求：${source}`;
  if (risk === 'HIGH') return `明确本科硬约束：${source}`;
  if (risk === 'MEDIUM') return `普通本科要求：${source}`;
  return `低学历风险：${source}`;
}

function materialHash(job: any) {
  return sha256(JSON.stringify([
    job.title, job.company, job.salaryText, job.experience, job.education,
    `${job.city ?? ''} ${job.district ?? ''}`.trim(), job.jdText ?? '', job.recruiterActivity
  ].map((value) => value ?? '')));
}

function ensureBossProvider(db: any, now: string) {
  db.prepare(`INSERT INTO providers(id,code,name,enabled,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET enabled=1,updated_at=excluded.updated_at`)
    .run('provider-boss', 'boss', 'BOSS直聘', 1, now, now);
  return (db.prepare('SELECT id FROM providers WHERE code=?').get('boss') as any).id;
}

const MATCH_EVALUATOR_VERSION = 'phase1-rule-v1';

export function evaluateJobAgainstActiveBaselines(db: any, jobId: string, now: string) {
  const job: any = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
  if (!job) return 0;
  const baselines: any[] = db.prepare('SELECT * FROM match_baselines WHERE is_active=1 ORDER BY id').all() as any[];
  let inserted = 0;
  for (const baseline of baselines) {
    const rows: any[] = db.prepare('SELECT * FROM match_terms WHERE baseline_id=? AND is_active=1 ORDER BY id').all(baseline.id) as any[];
    const terms = rows.map((row) => ({ term: row.term, matchType: row.match_type, weight: Number(row.weight || 0), active: Boolean(row.is_active) }));
    const text = [job.title, job.company, job.jd_text, job.role_family, job.seniority, job.education_text, job.experience_text, job.recruiter_activity]
      .map(normalizedText).filter(Boolean).join(' ');
    const result = evaluateMatch(text, terms);
    const inputHash = sha256(JSON.stringify({ text, terms: terms.map(({ term, matchType, weight }) => ({ term, matchType, weight })) }));
    const id = `match-${sha256(`${jobId}|${baseline.id}|${MATCH_EVALUATOR_VERSION}|${inputHash}`).slice(0, 24)}`;
    const before = db.prepare('SELECT 1 FROM job_match_results WHERE id=?').get(id);
    if (before) continue;
    db.prepare(`INSERT INTO job_match_results(
      id,job_id,baseline_id,rule_score,semantic_score,final_score,excluded,education_risk,
      matched_terms_json,risk_terms_json,excluded_terms_json,explanation_json,evaluator_version,evaluated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, jobId, baseline.id, result.ruleScore, null, result.finalScore, result.excluded ? 1 : 0,
      job.education_risk, JSON.stringify(result.matched.map((x:any)=>x.term)),
      JSON.stringify(result.risks.map((x:any)=>x.term)), JSON.stringify(result.excludedTerms.map((x:any)=>x.term)),
      JSON.stringify({ summary: '基于冻结词表的确定性评分', inputHash }), MATCH_EVALUATOR_VERSION, now
    );
    inserted += 1;
  }
  return inserted;
}
function ingestAcceptedJob(db: any, providerId: string, job: any, now: string) {
  const fingerprint = identityFingerprint(job);
  const jobId = `job-${fingerprint.slice(0, 24)}`;
  const sourceUrl = cleanSourceUrl(job.sourceUrl);
  const risk = classifyEducationRisk(job.education ?? '');
  const hash = materialHash(job);
  const existing: any = job.externalJobId
    ? db.prepare('SELECT * FROM jobs WHERE provider_id=? AND external_job_id=?').get(providerId, job.externalJobId)
    : db.prepare('SELECT * FROM jobs WHERE identity_fingerprint=?').get(fingerprint);
  const id = existing?.id ?? jobId;
  const snapshotExists = existing
    ? Boolean(db.prepare('SELECT 1 FROM job_snapshots WHERE job_id=? AND content_hash=?').get(id, hash))
    : false;

  db.exec('BEGIN;');
  try {
    if (!existing) {
      db.prepare(`INSERT INTO jobs(
        id,provider_id,external_job_id,identity_fingerprint,origin_kind,source_url,title,company,city,district,
        salary_text,experience_text,education_text,jd_text,recruiter_name,recruiter_activity,published_at,
        current_verification_status,education_risk,education_risk_reason,is_viewed,first_seen_at,last_seen_at,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, providerId, job.externalJobId ?? null, fingerprint, 'LIVE_DISCOVERY', sourceUrl,
        job.title ?? '', job.company ?? '', job.city ?? null, job.district ?? null,
        job.salaryText ?? null, job.experience ?? null, job.education ?? null, '',
        job.recruiterName ?? null, job.recruiterActivity ?? null, job.publishedAt ?? null,
        'NEW', risk, educationRiskReason(job.education, risk), 0, now, now, now, now
      );
    }
    if (!snapshotExists) {
      db.prepare(`INSERT INTO job_snapshots(
        id,job_id,captured_at,source_url,title,company,salary_text,experience_text,education_text,
        location_text,jd_text,recruiter_activity_text,content_hash,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        `snapshot-${sha256(`${id}|${hash}`).slice(0, 24)}`, id, now, sourceUrl,
        job.title ?? '', job.company ?? '', job.salaryText ?? null, job.experience ?? null,
        job.education ?? null, `${job.city ?? ''} ${job.district ?? ''}`.trim(), '',
        job.recruiterActivity ?? null, hash, now
      );
    }

    db.prepare(`INSERT INTO job_verifications(
      id,job_id,verified_at,status,method,page_exists,closed_signal,evidence_summary,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      `verification-${randomUUID()}`, id, now, 'LISTED', 'BOSS_SEARCH_LIST', 1, 0,
      `BOSS search list observation; published_at=${job.publishedAt ?? 'missing'}`, now
    );

    db.prepare(`UPDATE jobs SET source_url=?,title=?,company=?,city=?,district=?,salary_text=?,
      experience_text=?,education_text=?,recruiter_name=?,recruiter_activity=?,published_at=?,
      current_verification_status='LISTED',last_verified_at=?,education_risk=?,education_risk_reason=?,
      last_seen_at=?,updated_at=? WHERE id=?`).run(
      sourceUrl, job.title ?? '', job.company ?? '', job.city ?? null, job.district ?? null,
      job.salaryText ?? null, job.experience ?? null, job.education ?? null, job.recruiterName ?? null,
      job.recruiterActivity ?? null, job.publishedAt ?? null, now, risk,
      educationRiskReason(job.education, risk), now, now, id
    );
    evaluateJobAgainstActiveBaselines(db, id, now);
    db.exec('COMMIT;');
    return existing ? (snapshotExists ? 'duplicate' : 'updated') : 'new';
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

export function ingestBossSearchPayload(
  db: any,
  payload: any,
  options: { query: string; city?: string; now?: Date }
) {
  if (!payload?.ok) throw new Error('BOSS_SEARCH_NOT_OK');
  const now = (options.now ?? new Date()).toISOString();
  const providerId = ensureBossProvider(db, now);
  const normalized = normalizeBossSearchPayload(payload);
  const filtered = filterBossDiscovery(normalized.jobs, options.now ?? new Date());
  const runId = `search-${randomUUID()}`;

  db.prepare(`INSERT INTO search_runs(
    id,provider_id,query,city,filters_json,started_at,status,found_count,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    runId, providerId, options.query, options.city ?? '上海',
    JSON.stringify({ page: normalized.pagination.page }), now, 'RUNNING', normalized.jobs.length, now
  );

  let newCount = 0; let updatedCount = 0; let duplicateCount = 0;
  try {
    for (const job of filtered.accepted) {
      const kind = ingestAcceptedJob(db, providerId, job, now);
      if (kind === 'new') newCount += 1;
      else if (kind === 'updated') updatedCount += 1;
      else duplicateCount += 1;
    }


    const missingPublishEvidence = sanitizeBossObservation(filtered.accepted
      .filter((item: any) => !item.publishedAt)
      .map((item: any) => ({ externalJobId: item.externalJobId ?? item.id ?? null, reason: 'PUBLISHED_AT_MISSING' })));
    const blockedEvidence = sanitizeBossObservation(filtered.blocked.map(({ item, reason }: any) => ({
      externalJobId: item.externalJobId ?? null,
      reason
    })));
    const rejectedEvidence = filtered.rejected.map(({ id, reason }: any) => ({ id: id ?? null, reason }));
    const errorSummary = missingPublishEvidence.length || blockedEvidence.length || rejectedEvidence.length
      ? JSON.stringify({ observations: missingPublishEvidence, blocked: blockedEvidence, rejected: rejectedEvidence })
      : null;

    db.prepare(`UPDATE search_runs SET finished_at=?,status='SUCCEEDED',new_count=?,updated_count=?,
      duplicate_count=?,blocked_count=?,error_summary=? WHERE id=?`).run(
      now, newCount, updatedCount, duplicateCount, filtered.blocked.length, errorSummary, runId
    );

    return {
      runId,
      newCount,
      updatedCount,
      duplicateCount,
      blockedCount: filtered.blocked.length,
      rejectedCount: filtered.rejected.length
    };
  } catch (error) {
    db.prepare(`UPDATE search_runs SET finished_at=?,status='FAILED',new_count=?,updated_count=?,
      duplicate_count=?,blocked_count=?,error_summary=? WHERE id=?`).run(
      now, newCount, updatedCount, duplicateCount, filtered.blocked.length, 'INGESTION_FAILED', runId
    );
    throw error;
  }
}


export function ingestBossDetailPayload(db: any, externalJobId: string, payload: any, nowDate = new Date()) {
  const detail = normalizeBossDetailPayload(payload);
  const now = nowDate.toISOString();
  const provider: any = db.prepare("SELECT id FROM providers WHERE code='boss'").get();
  if (!provider) throw new Error('BOSS_PROVIDER_NOT_FOUND');
  const existing: any = db.prepare('SELECT * FROM jobs WHERE provider_id=? AND external_job_id=?').get(provider.id, externalJobId);
  if (!existing) throw new Error('BOSS_DETAIL_JOB_NOT_FOUND');
  const merged: any = {
    externalJobId,
    title: detail.title ?? existing.title,
    company: detail.company ?? existing.company,
    salaryText: detail.salaryText ?? existing.salary_text,
    city: detail.city ?? existing.city,
    district: detail.district ?? existing.district,
    experience: detail.experience ?? existing.experience_text,
    education: detail.education ?? existing.education_text,
    jdText: detail.jdText ?? existing.jd_text ?? '',
    recruiterName: detail.recruiterName ?? existing.recruiter_name,
    recruiterActivity: detail.recruiterActivity ?? existing.recruiter_activity,
    sourceUrl: detail.sourceUrl ?? existing.source_url
  };
  const sourceUrl = cleanSourceUrl(merged.sourceUrl);
  const hash = materialHash(merged);
  const snapshotExists = Boolean(db.prepare('SELECT 1 FROM job_snapshots WHERE job_id=? AND content_hash=?').get(existing.id, hash));

  db.exec('BEGIN;');
  try {
    db.prepare(`UPDATE jobs SET source_url=?,title=?,company=?,city=?,district=?,address=?,salary_text=?,experience_text=?,education_text=?,jd_text=?,recruiter_name=?,recruiter_activity=?,last_seen_at=?,updated_at=? WHERE id=?`).run(
      sourceUrl, merged.title ?? '', merged.company ?? '', merged.city ?? null, merged.district ?? null,
      detail.address ?? existing.address ?? null, merged.salaryText ?? null, merged.experience ?? null,
      merged.education ?? null, merged.jdText ?? '', merged.recruiterName ?? null,
      merged.recruiterActivity ?? null, now, now, existing.id
    );
    if (!snapshotExists) {
      db.prepare(`INSERT INTO job_snapshots(
        id,job_id,captured_at,source_url,title,company,salary_text,experience_text,education_text,
        location_text,jd_text,recruiter_activity_text,content_hash,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        `snapshot-${sha256(`${existing.id}|${hash}`).slice(0, 24)}`, existing.id, now, sourceUrl,
        merged.title ?? '', merged.company ?? '', merged.salaryText ?? null, merged.experience ?? null,
        merged.education ?? null, `${merged.city ?? ''} ${merged.district ?? ''}`.trim(), merged.jdText ?? '',
        merged.recruiterActivity ?? null, hash, now
      );
    }
    db.prepare(`INSERT INTO job_verifications(
      id,job_id,verified_at,status,method,page_exists,closed_signal,evidence_summary,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      `verification-${randomUUID()}`, existing.id, now, 'LISTED', 'BOSS_DETAIL', 1, 0,
      `BOSS detail read succeeded; description_present=${Boolean(merged.jdText)}`, now
    );
    evaluateJobAgainstActiveBaselines(db, existing.id, now);
    db.exec('COMMIT;');
    return { jobId: existing.id, snapshotCreated: !snapshotExists };
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

export async function runBossSearchIngestion(
  db: any,
  query: string,
  options: {
    city?: string;
    page?: number;
    now?: Date;
    timeoutMs?: number;
    maxOutputBytes?: number;
    runner?: (args: string[], options?: any) => Promise<any>;
  } = {}
) {
  const city = options.city ?? '上海';
  const page = options.page ?? 1;
  const command = buildBossSearchCommand(query, { city, page });
  const runner = options.runner ?? runBossCliJson;
  const payload = await runner(command.args, {
    executable: command.file,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes
  });
  return ingestBossSearchPayload(db, payload, { query, city, now: options.now });
}


export async function runBossSearchDetailIngestion(
  db: any,
  query: string,
  options: {
    city?: string;
    page?: number;
    now?: Date;
    timeoutMs?: number;
    maxOutputBytes?: number;
    maxDetails?: number;
    runner?: (args: string[], options?: any) => Promise<any>;
  } = {}
) {
  const city = options.city ?? '上海';
  const page = options.page ?? 1;
  const runner = options.runner ?? runBossCliJson;
  const searchCommand = buildBossSearchCommand(query, { city, page });
  const searchPayload = await runner(searchCommand.args, {
    executable: searchCommand.file,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes
  });
  const search = ingestBossSearchPayload(db, searchPayload, { query, city, now: options.now });
  const rawRows = Array.isArray(searchPayload?.data) ? searchPayload.data : [];
  const limit = Math.max(0, Math.trunc(options.maxDetails ?? rawRows.length));
  let detailSucceeded = 0;
  let detailFailed = 0;
  const detailErrors: Array<{ externalJobId: string | null; code: string }> = [];
  for (const row of rawRows.slice(0, limit)) {
    const securityId = row?.security_id ?? row?.securityId;
    const externalJobId = row?.job_id ?? row?.jobId;
    if (!securityId || !externalJobId) {
      detailFailed += 1;
      detailErrors.push({ externalJobId: externalJobId ?? null, code: 'DETAIL_TRANSIENT_ID_MISSING' });
      continue;
    }
    try {
      const command = buildBossDetailCommand(String(securityId), String(externalJobId));
      const detailPayload = await runner(command.args, {
        executable: command.file,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes
      });
      ingestBossDetailPayload(db, String(externalJobId), detailPayload, options.now ?? new Date());
      detailSucceeded += 1;
    } catch (error: any) {
      detailFailed += 1;
      detailErrors.push({ externalJobId: String(externalJobId), code: String(error?.code ?? error?.message ?? 'DETAIL_FAILED') });
    }
  }
  return { search, detailSucceeded, detailFailed, detailErrors };
}
