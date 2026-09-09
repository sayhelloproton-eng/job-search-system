import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase } from './db.ts';
import { bootstrapReferenceData, seedDatabase } from './seed.ts';

const APP_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const REPO_ROOT=resolve(APP_ROOT,'..');
const WEB=resolve(APP_ROOT,'web');

function careerFactsPath(demo=false){
  if(demo)return resolve(REPO_ROOT,'examples/candidate/career-facts.md');
  const configured=process.env.CAREER_FACTS_PATH?.trim();
  return configured ? resolve(configured) : resolve(REPO_ROOT,'examples/candidate/career-facts.md');
}

const json=(res:any,body:any,status=200)=>{
  res.writeHead(status,{'content-type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
};

const careerFacts=(demo=false)=>{
  const path=careerFactsPath(demo);
  try{return[{path,available:true,content:readFileSync(path,'utf8')}]}
  catch{return[{path,available:false,content:null}]}
};

const baselines=(db:any)=>{
  const items:any[]=db.prepare('SELECT * FROM match_baselines ORDER BY name').all() as any[];
  for(const baseline of items){
    baseline.terms=db.prepare('SELECT * FROM match_terms WHERE baseline_id=? ORDER BY match_type,term').all(baseline.id);
  }
  return items;
};

const personalProfile=(facts:any[],baselineItems:any[])=>{
  const active=baselineItems.filter((baseline)=>Boolean(baseline.is_active));
  const terms=active.flatMap((baseline)=>baseline.terms
    .filter((term:any)=>Boolean(term.is_active))
    .map((term:any)=>({...term,baseline_id:baseline.id,direction:baseline.direction})));
  return{
    source_paths:facts.map(({path,available})=>({path,available})),
    directions:active.map(({id,name,direction,description})=>({baseline_id:id,name,direction,description})),
    positive_signals:terms.filter((term:any)=>['STRONG_BOOST','BOOST','INCLUDE'].includes(term.match_type)),
    risk_signals:terms.filter((term:any)=>['RISK','STRONG_RISK','EXCLUDE'].includes(term.match_type)),
  };
};

export function createApp(options:any={}){
  const demo=options.demo===true;
  const dbPath=demo
    ? ':memory:'
    : options.dbPath||process.env.JOB_SEARCH_DB_PATH||resolve(APP_ROOT,'db/runtime/job-search.db');
  const db=openDatabase(dbPath);
  if(demo||options.seed===true)seedDatabase(db);
  else bootstrapReferenceData(db);

  const server=createHttpServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/','http://localhost');

      if(url.pathname==='/api/jobs'){
        const where:string[]=[];const args:any[]=[];
        const q=url.searchParams.get('q');
        const risk=url.searchParams.get('risk');
        const status=url.searchParams.get('status');
        const provider=url.searchParams.get('provider');
        const scope=url.searchParams.get('scope');

        if(q){where.push('(j.title LIKE ? OR j.company LIKE ? OR j.jd_text LIKE ?)');args.push(`%${q}%`,`%${q}%`,`%${q}%`);}
        if(risk){where.push('j.education_risk=?');args.push(risk);}
        if(status){where.push('j.current_verification_status=?');args.push(status);}
        if(provider){where.push('p.code=?');args.push(provider);}

        if(scope!=='all'){
          where.push(`(
            LOWER(j.title) LIKE '%agent%' OR j.title LIKE '%智能体%' OR j.title LIKE '%大模型%'
            OR LOWER(j.title) LIKE '%llm%' OR j.title LIKE '%全栈%' OR j.title LIKE '%高级前端%'
            OR j.title LIKE '%资深前端%' OR j.title LIKE '%研发效能%' OR UPPER(j.title) LIKE '%FDE%'
          )`);
          where.push(`(
            j.title LIKE '%开发%' OR j.title LIKE '%研发%' OR j.title LIKE '%工程师%'
            OR j.title LIKE '%全栈%' OR j.title LIKE '%前端%' OR j.title LIKE '%后端%'
            OR j.title LIKE '%算法%' OR j.title LIKE '%平台%' OR UPPER(j.title) LIKE '%FDE%'
          )`);
          for(const term of ['实习','校招','应届','管培','毕业生','校园招聘','负责人','总监','主管','经理','首席','架构师','专家','Leader','Head']){
            where.push('j.title NOT LIKE ?');args.push(`%${term}%`);
          }
          where.push("j.title NOT GLOB '*[0-9][0-9]届*'");
          for(const term of ['实习','校招','应届','在校','管培']){
            where.push("COALESCE(j.experience_text,'') NOT LIKE ?");args.push(`%${term}%`);
          }
        }

        const sql=`SELECT
          j.id,j.title,j.company,p.code provider,p.name provider_name,j.city,j.district,j.salary_text,
          j.experience_text,j.education_text,j.education_risk,j.education_risk_reason,
          j.current_verification_status,j.last_verified_at,j.first_seen_at,j.is_viewed,j.published_at,
          j.recruiter_activity,j.recruiter_recently_active,j.source_url,
          COALESCE((SELECT final_score FROM job_match_results m WHERE m.job_id=j.id ORDER BY evaluated_at DESC LIMIT 1),50) final_score
          FROM jobs j JOIN providers p ON p.id=j.provider_id
          ${where.length?'WHERE '+where.join(' AND '):''}
          ORDER BY j.published_at IS NULL ASC,j.published_at DESC,
          CASE WHEN j.district='青浦区' THEN 0 ELSE 1 END,final_score DESC,j.first_seen_at DESC`;
        return json(res,{items:db.prepare(sql).all(...args)});
      }

      if(url.pathname.startsWith('/api/jobs/')){
        const id=decodeURIComponent(url.pathname.split('/').pop()!);
        const job:any=db.prepare('SELECT j.*,p.code provider,p.name provider_name FROM jobs j JOIN providers p ON p.id=j.provider_id WHERE j.id=?').get(id);
        if(!job)return json(res,{error:'NOT_FOUND'},404);
        return json(res,{
          job,
          snapshots:db.prepare('SELECT * FROM job_snapshots WHERE job_id=? ORDER BY captured_at DESC').all(id),
          verifications:db.prepare('SELECT * FROM job_verifications WHERE job_id=? ORDER BY verified_at DESC').all(id),
          match:db.prepare('SELECT * FROM job_match_results WHERE job_id=? ORDER BY evaluated_at DESC LIMIT 1').get(id),
        });
      }

      if(url.pathname==='/api/resumes')return json(res,{items:db.prepare('SELECT * FROM resumes ORDER BY is_active DESC,updated_at DESC').all()});
      if(url.pathname==='/api/baselines')return json(res,{items:baselines(db)});
      if(url.pathname==='/api/personal-info')return json(res,{sources:careerFacts(demo),baselines:baselines(db)});
      if(url.pathname==='/api/personal-profile'){
        const facts=careerFacts(demo);const baselineItems=baselines(db);
        return json(res,personalProfile(facts,baselineItems));
      }

      const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const path=resolve(WEB,file);
      if(!path.startsWith(WEB))return json(res,{error:'BAD_PATH'},400);
      const type={
        '.html':'text/html; charset=utf-8',
        '.js':'text/javascript; charset=utf-8',
        '.css':'text/css; charset=utf-8',
      }[extname(path)]||'text/plain; charset=utf-8';
      const content=readFileSync(path);
      res.writeHead(200,{'content-type':type});
      res.end(content);
    }catch(error:any){
      if(error?.code==='ENOENT')return json(res,{error:'NOT_FOUND'},404);
      json(res,{error:error?.message||'INTERNAL_ERROR'},500);
    }
  });

  return{
    server,
    db,
    close:()=>new Promise<void>((resolveClose)=>{
      if(!server.listening){db.close();resolveClose();return;}
      server.close(()=>{db.close();resolveClose();});
    }),
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const demo=process.argv.includes('--demo');
  const {server}=createApp({demo});
  const port=Number(process.env.PORT||4317);
  server.listen(port,'127.0.0.1',()=>{
    console.log(`Job Search System${demo?' (demo)':''}: http://127.0.0.1:${port}`);
  });
}
