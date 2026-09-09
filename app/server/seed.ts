const PROVIDERS = [
  ['p-boss', 'boss', 'BOSS直聘'],
  ['p-liepin', 'liepin', '猎聘'],
  ['p-zhaopin', 'zhaopin', '智联招聘'],
  ['p-51job', '51job', '51Job']
] as const;

export function bootstrapReferenceData(db:any){
  const now=new Date().toISOString();
  db.prepare(`DELETE FROM jobs
    WHERE id IN ('j1','j2','j3','j4','j5','j6')
      AND source_url LIKE 'https://example.local/%'`).run();

  const provider=db.prepare(`INSERT INTO providers(id,code,name,enabled,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,enabled=1,updated_at=excluded.updated_at`);
  for(const [id,code,name] of PROVIDERS)provider.run(id,code,name,1,now,now);

  db.prepare(`INSERT INTO match_baselines(id,name,direction,description,is_active,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run('b1','Agent / AI 工程方向','AI Agent','优先 Agent、TypeScript、MCP、研发效能；识别岗位风险。',1,now,now);

  const term=db.prepare(`INSERT INTO match_terms(id,baseline_id,term,match_type,category,weight,notes,is_active,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`);
  const terms=[
    ['t1','Agent','STRONG_BOOST','核心能力',25],
    ['t2','TypeScript','BOOST','技术栈',12],
    ['t3','MCP','BOOST','Agent基础设施',15],
    ['t4','研发效能','INCLUDE','方向',10],
    ['t5','外包','EXCLUDE','岗位风险',0],
  ];
  for(const row of terms)term.run(row[0],'b1',row[1],row[2],row[3],row[4],'公开 Demo 基线',1,now,now);

  const resume=db.prepare(`INSERT INTO resumes(
    id,name,direction,source_path,snapshot_path,content,content_hash,version_label,is_active,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,direction=excluded.direction,source_path=excluded.source_path,snapshot_path=excluded.snapshot_path,
    content=excluded.content,content_hash=excluded.content_hash,version_label=excluded.version_label,
    is_active=excluded.is_active,updated_at=excluded.updated_at`);
  resume.run(
    'r-demo-facts','Demo Career Facts','事实真源',
    'examples/candidate/career-facts.md',null,
    'Synthetic candidate facts for public demo.','demo-career-facts-v1','demo-v1',1,now,now
  );
  resume.run(
    'r-demo-resume','Demo Resume','AI / Full-stack',
    'examples/candidate/resume.md',null,
    'Synthetic resume for public demo.','demo-resume-v1','demo-v1',1,now,now
  );
}

export function seedDatabase(db:any){
  bootstrapReferenceData(db);
  const count:any=db.prepare('SELECT COUNT(*) AS c FROM jobs').get();
  if(Number(count.c)>0)return;

  const now=new Date().toISOString();
  const providerId=Object.fromEntries(PROVIDERS.map(([,code])=>[
    code,(db.prepare('SELECT id FROM providers WHERE code=?').get(code) as any).id
  ]));

  const jobs:any[]=[
    ['j1','boss','boss-1001','fp1','LIVE_DISCOVERY','https://example.local/boss/1001','AI Agent 平台前端工程师','星云科技','上海','浦东新区','30-45K·15薪',30000,45000,15,'5-10年','本科','前端/Agent','资深','负责 Agent 平台、浏览器自动化、TypeScript 与 AI 工具链建设。','王女士','今日活跃','LIVE_CONFIRMED','MEDIUM','普通本科要求，继续展示',92],
    ['j2','liepin','lp-2002','fp2','LIVE_DISCOVERY','https://example.local/liepin/2002','Coding Agent 研发工程师','矩阵智能','上海','徐汇区','35-55K·14薪',35000,55000,14,'3-5年','统招本科 985/211','AI研发效能','资深','负责 Coding Agent、代码理解、MCP 与研发效能平台。','陈经理','刚刚活跃','RECRUITER_CONFIRMED','HIGH','明确统招本科/985 约束',88],
    ['j3','zhaopin','zh-3003','fp3','LIVE_DISCOVERY','https://example.local/zhaopin/3003','AI 全栈工程师','云帆网络','杭州','余杭区','25-40K·13薪',25000,40000,13,'3-5年','本科','AI全栈','高级','Node.js、TypeScript、LLM 应用、RAG 与 Agent 工作流。','刘女士','3日内活跃','BLOCKED','MEDIUM','普通本科要求',81],
    ['j4','boss','boss-1004','fp4','LIVE_DISCOVERY','https://example.local/boss/1004','资深前端工程师（云平台）','青空云','上海','闵行区','28-42K·14薪',28000,42000,14,'5年以上','本科','前端/云平台','资深','大型前端平台、微前端、工程化与云控制台。','赵先生','本周活跃','LISTED','MEDIUM','普通本科要求',76],
    ['j5','51job','51-5005','fp5','HISTORICAL_IMPORT','https://example.local/51job/5005','前端开发工程师','旧城软件','上海','静安区','20-30K',20000,30000,12,'5年','本科','前端','高级','历史导入 JD，用于验证 STALE 与历史语义。',null,null,'STALE','MEDIUM','历史 JD + 普通本科',62],
    ['j6','liepin','lp-2006','fp6','LIVE_DISCOVERY','https://example.local/liepin/2006','Agent 解决方案工程师','未来实验室','北京','海淀区','40-60K·15薪',40000,60000,15,'5-10年','硕士及以上','Agent应用','专家','Agent 方案、模型应用、客户交付与技术架构。','周女士','今日活跃','CLOSED','VERY_HIGH','明确硕士及以上要求',69],
  ];

  const insertJob=db.prepare(`INSERT INTO jobs(
    id,provider_id,external_job_id,identity_fingerprint,origin_kind,source_url,title,company,city,district,
    salary_text,salary_min,salary_max,salary_months,experience_text,education_text,role_family,seniority,jd_text,
    recruiter_name,recruiter_activity,current_verification_status,last_verified_at,education_risk,
    education_risk_reason,is_viewed,first_seen_at,last_seen_at,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for(const job of jobs)insertJob.run(
    job[0],providerId[job[1]],...job.slice(2,22),now,...job.slice(22,24),0,now,now,now,now
  );

  const snapshot=db.prepare(`INSERT INTO job_snapshots(
    id,job_id,captured_at,source_url,title,company,salary_text,experience_text,education_text,
    location_text,jd_text,recruiter_activity_text,content_hash,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for(const job of jobs)snapshot.run(
    `s-${job[0]}`,job[0],now,job[5],job[6],job[7],job[10],job[14],job[15],
    `${job[8]} ${job[9]}`,job[18],job[20]||'',`hash-${job[0]}`,now
  );

  const verification=db.prepare(`INSERT INTO job_verifications(
    id,job_id,verified_at,status,confidence,method,page_exists,closed_signal,contact_action_available,
    apply_action_available,recruiter_active,recruiter_confirmed,evidence_summary,error_code,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for(const job of jobs){
    const status=job[21];
    verification.run(
      `v-${job[0]}`,job[0],now,status,status==='BLOCKED'?0.2:0.9,'SEEDED_EVIDENCE',
      status==='CLOSED'?0:1,status==='CLOSED'?1:0,
      status==='LIVE_CONFIRMED'||status==='RECRUITER_CONFIRMED'?1:0,
      status==='LIVE_CONFIRMED'||status==='RECRUITER_CONFIRMED'?1:0,
      job[20]?1:0,status==='RECRUITER_CONFIRMED'?1:0,
      status==='BLOCKED'?'security_check blocked verification':'synthetic first-version evidence',
      status==='BLOCKED'?'SECURITY_CHECK':null,now
    );
  }

  const match=db.prepare(`INSERT INTO job_match_results(
    id,job_id,baseline_id,rule_score,semantic_score,final_score,excluded,education_risk,
    matched_terms_json,risk_terms_json,excluded_terms_json,explanation_json,evaluator_version,evaluated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for(const job of jobs)match.run(
    `m-${job[0]}`,job[0],'b1',job[24],null,job[24],0,job[22],
    JSON.stringify(['Agent/技术栈匹配']),'[]','[]',
    JSON.stringify({summary:'基于公开 Demo 基线的确定性评分'}),'public-v0.1',now
  );
}
