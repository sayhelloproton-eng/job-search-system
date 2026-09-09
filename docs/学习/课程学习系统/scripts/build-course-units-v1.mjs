import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const termFile=path.join(root,'docs/学习/术语学习系统/data/terms-v1.json');
const terms=JSON.parse(fs.readFileSync(termFile,'utf8')).items;
const termByName=new Map(terms.map(t=>[t.canonicalName,t]));
const base='docs/学习/内容';
const configs=[
 {id:'course.agent-runtime',file:'01-智能体运行时工具与权限.md',title:'Agent Runtime / Tool / MCP / Permission',chains:['agent','fullstack'],priority:'P0',prerequisiteUnitIds:[],core:['Agent','Agent Runtime','Tool','Tool Calling','Function Calling','MCP','Permission','Authorization','Hook','Skill','Subagent','Context Engineering','Idempotency Key','Audit Trail'],candidates:[]},
 {id:'course.rag-retrieval',file:'02-检索增强与向量数据库.md',title:'RAG / Retrieval / Vector DB',chains:['agent','backend'],priority:'P0',prerequisiteUnitIds:['course.agent-runtime'],core:['RAG','Retrieval Result','Embedding','Chunk','Top-k','Metadata','Dense Retrieval','Sparse Retrieval','BM25','Hybrid Retrieval','Reranker','Agentic RAG','Grounding','Vector Database','Authorization','Recall@K'],candidates:['ACL']},
 {id:'course.python-fastapi',file:'03-第二服务端路径.md',title:'Python / FastAPI 第二服务端路径',chains:['backend','fullstack'],priority:'P0',prerequisiteUnitIds:[],core:['Python AI Service','async/await','Async','Dependency','OpenAPI','Timeout','Health Check','Readiness Probe'],candidates:['FastAPI','Pydantic','Dependency Injection','HTTPX','Lifespan','pytest']},
 {id:'course.backend-production',file:'04-后端生产完备性与系统设计.md',title:'Backend Production Completeness / System Design',chains:['backend','fullstack','agent'],priority:'P0',prerequisiteUnitIds:['course.agent-runtime'],core:['REST','SSE','WebSocket','Relational Database','Transaction','Idempotency Key','Transactional Outbox','Saga','Authentication','Authorization','RBAC','Queue','Worker','Dead-letter Queue','Observability','Trace','Rate Limiting','Circuit Breaker','Backpressure'],candidates:[]},
 {id:'course.context-state-memory',file:'05-上下文状态记忆编排.md',title:'Context / State / Memory / Orchestration',chains:['agent','backend'],priority:'P0',prerequisiteUnitIds:['course.agent-runtime'],core:['Context Engineering','Runtime State','Memory','Long-term Memory','Short-term Memory','Episodic Memory','Procedural Memory','Checkpoint','Resume','Human-in-the-loop','Retry','Timeout','Cancellation','Workflow','State Machine'],candidates:[]},
 {id:'course.testing-eval-reliability',file:'06-测试评估交付与可靠性.md',title:'Testing / Eval / CI / Docker / Reliability',chains:['agent','backend','fullstack'],priority:'P0',prerequisiteUnitIds:['course.agent-runtime'],core:['Unit Test','Contract Test','Integration Test','Eval','Retrieval Eval','Trajectory Eval','Regression Eval','CI','Docker Image','Dockerfile','Health Check','Readiness Probe','Trace','Idempotency','Authorization'],candidates:['Groundedness']},
 {id:'course.framework-fde-system-design',file:'07-框架前线部署与系统设计.md',title:'Frameworks / FDE / System Design',chains:['agent','fullstack','backend'],priority:'P1',prerequisiteUnitIds:['course.agent-runtime','course.rag-retrieval','course.context-state-memory','course.testing-eval-reliability'],core:['LangGraph','LlamaIndex','AutoGen','Dify','Kubernetes Deployment','Kubernetes RBAC','ConfigMap','Secret','Rolling Update','Readiness Probe','HPA','Agent Runtime','Checkpoint','Human-in-the-loop','Workflow'],candidates:['FDE']},
];
function parseSections(text){
 const lines=text.split('\n'); let title='', current=null; const sections=[];
 for(const line of lines){
  if(line.startsWith('# ')&&!title){title=line.slice(2).trim(); continue;}
  if(line.startsWith('## ')){current={heading:line.slice(3).trim(),body:[]}; sections.push(current); continue;}
  if(current) current.body.push(line);
 }
 return {title,sections:sections.map(s=>({heading:s.heading,content:s.body.join('\n').trim()}))};
}
function findSection(sections,patterns){return sections.find(s=>patterns.some(p=>s.heading.includes(p)))?.content??'';}
const items=[]; const unresolved=new Map();
for(const cfg of configs){
 const sourcePath=path.join(root,base,cfg.file); const raw=fs.readFileSync(sourcePath,'utf8'); const parsed=parseSections(raw);
 const resolved=[];
 for(const name of cfg.core){ const t=termByName.get(name); if(!t) throw new Error(`CONFIGURED_TERM_MISSING:${cfg.id}:${name}`); resolved.push({termId:t.id,canonicalName:t.canonicalName}); }
 for(const name of cfg.candidates){ if(termByName.has(name)) throw new Error(`CANDIDATE_ALREADY_CANONICAL:${name}`); if(!unresolved.has(name)) unresolved.set(name,[]); unresolved.get(name).push(cfg.id); }
 const questionSections=parsed.sections.filter(s=>s.heading.includes('高频')||s.heading.includes('面试题'));
 const failureSections=parsed.sections.filter(s=>s.heading.includes('故障')||s.heading.includes('系统设计题')||s.heading.includes('最小代码能力验收'));
 const whySection=parsed.sections.find(s=>['JD 为什么问','原则'].some(x=>s.heading.includes(x)));
 const mentalSection=parsed.sections.find(s=>['必懂系统图','最小链路','面试需要达到的深度','一张完整后端图','三层必须分开','测试分层','Framework 选型答题模板'].some(x=>s.heading.includes(x)));
 const evidence=findSection(parsed.sections,['你的证据映射','你的证据边界']);
 const official=findSection(parsed.sections,['官方核验']);
 items.push({schemaVersion:'course-unit.v1',id:cfg.id,title:cfg.title,sourceDoc:`${base}/${cfg.file}`,chains:cfg.chains,priority:cfg.priority,prerequisiteUnitIds:cfg.prerequisiteUnitIds,
  why:whySection?.content??'',
  mentalModel:mentalSection?.content??'',
  contentSections:parsed.sections.filter(s=>s!==whySection&&s!==mentalSection&&!questionSections.includes(s)&&!failureSections.includes(s)&&!['你的证据映射','你的证据边界','官方核验'].some(x=>s.heading.includes(x))),
  interviewTransfer:questionSections,
  failurePractice:failureSections,
  evidenceBoundary:evidence,officialVerification:official,
  linkedTerms:resolved,unresolvedConcepts:cfg.candidates,
  contentStatus:'SOURCE_BACKED_MATERIALIZED',reviewedAt:'2026-09-09'});
}
const output={schemaVersion:'course-units.v1',generatedAt:'2026-09-09T00:00:00.000Z',sourceType:'LEGACY_COURSE_CONTENT_MIGRATION',unitCount:items.length,items,
unresolvedConcepts:[...unresolved].map(([canonicalName,unitIds])=>({canonicalName,unitIds,status:'TERM_CANDIDATE_REVIEW_REQUIRED'}))};
fs.writeFileSync('docs/学习/课程学习系统/data/course-units-v1.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({units:items.length,linkedTerms:new Set(items.flatMap(x=>x.linkedTerms.map(y=>y.termId))).size,unresolved:output.unresolvedConcepts},null,2));
