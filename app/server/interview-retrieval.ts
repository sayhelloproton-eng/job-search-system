type RetrievalInput = {
  sessionId?:string;
  routeId:string;
  queryText?:string;
  targetSignalId?:string;
  preferredFamilyId?:string;
  currentFamilyId?:string;
  intent?:'ASK'|'FOLLOW_UP'|'CHALLENGE'|'CLARIFY';
  limit?:number;
};

type GoldenQuestion = {
  id:string;
  familyId:string;
  text:string;
  lifecycle:'ACTIVE'|'OBSERVATION_ONLY';
  preferredEvidenceId?:string;
  tags?:string;
};

const GOLDEN_QUESTIONS:GoldenQuestion[]=[
  {id:'q.build.1',familyId:'qf.build-vs-buy',text:'为什么没有直接采用现成框架，而选择自己实现？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.agent-runtime-boundary',tags:'build-vs-buy 自研 现成框架'},
  {id:'q.build.2',familyId:'qf.build-vs-buy',text:'Build vs Buy 时你怎么判断自研还是复用？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.agent-runtime-boundary',tags:'build vs buy 复用 自研'},
  {id:'q.ownership.devtools',familyId:'qf.ownership',text:'团队工具项目里哪些关键决策是你本人主导的？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.devtools-ownership',tags:'developer tooling ownership 主导 团队'},
  {id:'q.ownership.platform',familyId:'qf.ownership',text:'多环境平台交付里你本人真正负责什么？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.platform-delivery',tags:'platform delivery ownership'},
  {id:'q.failure.workflow',familyId:'qf.failure-tradeoff',text:'长任务通信为什么最后需要重做为有界步骤和 durable state？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.workflow-recovery',tags:'workflow recovery failure durable state'},
  {id:'q.failure.migration',familyId:'qf.failure-tradeoff',text:'共享平台迁移过程中最典型的失败或收尾问题是什么？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.platform-migration',tags:'platform migration 兼容 failure'},
  {id:'q.unknown.1',familyId:'qf.unknown-boundary',text:'遇到没有做过的系统时，你怎么控制边界并验证方案？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.agent-runtime-boundary',tags:'unknown boundary 验证'},
  {id:'q.unknown.2',familyId:'qf.unknown-boundary',text:'如果你不确定一个技术结论，现场会怎么处理？',lifecycle:'ACTIVE',preferredEvidenceId:'ev.demo.agent-runtime-boundary',tags:'unknown uncertainty verification'},
  {id:'q.obs.market',familyId:'qf.unknown-boundary',text:'社区最近流行问什么 AI 面试题？',lifecycle:'OBSERVATION_ONLY',tags:'market observation'},
];

const GOLDEN_EDGES=[
  ['edge.ownership.failure','qf.ownership','qf.failure-tradeoff','FOLLOW_UP',100],
  ['edge.build.failure','qf.build-vs-buy','qf.failure-tradeoff','CHALLENGE',90],
  ['edge.failure.unknown','qf.failure-tradeoff','qf.unknown-boundary','CLARIFY',80],
] as const;

export function registerRetrievalGoldenCorpus(db:any,now=new Date().toISOString()){
  const q=db.prepare(`INSERT INTO interview_questions(
    id,question_family_id,canonical_text,language,difficulty,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,'zh-CN','SENIOR',?,?,?)
  ON CONFLICT(id) DO UPDATE SET canonical_text=excluded.canonical_text,lifecycle=excluded.lifecycle,updated_at=excluded.updated_at`);
  const fts=db.prepare(`INSERT INTO interview_question_search(item_type,item_id,family_id,text,tags,signal_terms)
    VALUES('QUESTION',?,?,?,?,?)`);
  for(const item of GOLDEN_QUESTIONS){
    q.run(item.id,item.familyId,item.text,item.lifecycle,now,now);
    db.prepare("DELETE FROM interview_question_search WHERE item_type='QUESTION' AND item_id=?").run(item.id);
    const signal:any=db.prepare(`SELECT s.id,s.name FROM interview_question_families f
      JOIN interview_signals s ON s.id=f.primary_signal_id WHERE f.id=?`).get(item.familyId);
    const tags=`${item.tags??''} evidence:${item.preferredEvidenceId??''}`.trim();
    fts.run(item.id,item.familyId,item.text,tags,`${signal?.id??''} ${signal?.name??''}`);
  }
  const edge=db.prepare(`INSERT INTO interview_question_edges(
    id,from_question_family_id,to_question_family_id,edge_type,priority,condition_json,lifecycle,created_at,updated_at
  ) VALUES(?,?,?,?,?,'{}','ACTIVE',?,?)
  ON CONFLICT(id) DO UPDATE SET priority=excluded.priority,updated_at=excluded.updated_at`);
  for(const [id,from,to,type,priority] of GOLDEN_EDGES) edge.run(id,from,to,type,priority,now,now);
}

const STRENGTH_SCORE:Record<string,number>={STRONG:60,MEDIUM:35,WEAK:15,DEFENSIVE:5};
const STATEMENTS=new WeakMap<object,any>();

function statements(db:any){
  let s=STATEMENTS.get(db as object);
  if(s)return s;
  s={
    routeLinks:db.prepare(`SELECT question_family_id,evidence_ref_id,route_id,strength
      FROM interview_question_evidence_links WHERE lifecycle='ACTIVE'`),
    routeStamp:db.prepare(`SELECT COUNT(*) c,COALESCE(MAX(updated_at),'') m
      FROM interview_question_evidence_links WHERE lifecycle='ACTIVE'`),
    topicRouteRows:db.prepare(`SELECT DISTINCT l.question_family_id,e.route_id
      FROM interview_family_topic_links l
      JOIN interview_topic_route_expectations e ON e.topic_id=l.topic_id
      WHERE l.lifecycle='ACTIVE' AND e.lifecycle='ACTIVE'`),
    topicRouteStamp:db.prepare(`SELECT
      (SELECT COUNT(*) FROM interview_family_topic_links WHERE lifecycle='ACTIVE') lc,
      (SELECT COALESCE(MAX(updated_at),'') FROM interview_family_topic_links WHERE lifecycle='ACTIVE') lm,
      (SELECT COUNT(*) FROM interview_topic_route_expectations WHERE lifecycle='ACTIVE') ec,
      (SELECT COALESCE(MAX(updated_at),'') FROM interview_topic_route_expectations WHERE lifecycle='ACTIVE') em`),
    fts:db.prepare(`SELECT item_id,text,tags,signal_terms
      FROM interview_question_search WHERE interview_question_search MATCH ?`),
    asked:db.prepare(`SELECT question_id FROM interview_turns WHERE session_id=? AND question_id IS NOT NULL`),
    turns:db.prepare(`SELECT question_id,question_family_id,selected_evidence_json
      FROM interview_turns WHERE session_id=? ORDER BY turn_index DESC LIMIT 6`),
    closedSignals:db.prepare(`SELECT signal_id FROM interview_session_signals
      WHERE session_id=? AND state IN ('CONFIRMED','CLOSED')`),
    graph:db.prepare(`SELECT to_question_family_id,priority,edge_type FROM interview_question_edges
      WHERE from_question_family_id=? AND lifecycle='ACTIVE'`),
    questions:db.prepare(`SELECT q.id question_id,q.question_family_id,q.canonical_text,q.lifecycle,
      f.primary_signal_id signal_id,s.tags
      FROM interview_questions q
      JOIN interview_question_families f ON f.id=q.question_family_id
      LEFT JOIN interview_question_search s ON s.item_id=q.id AND s.item_type='QUESTION'
      WHERE q.lifecycle='ACTIVE' AND f.lifecycle='ACTIVE'`),
    questionStamp:db.prepare(`SELECT COUNT(*) c,COALESCE(MAX(q.updated_at),'') qmax,COALESCE(MAX(f.updated_at),'') fmax
      FROM interview_questions q JOIN interview_question_families f ON f.id=q.question_family_id
      WHERE q.lifecycle='ACTIVE' AND f.lifecycle='ACTIVE'`),
  };
  STATEMENTS.set(db as object,s);
  return s;
}

const CATALOGS=new WeakMap<object,any>();
function catalog(db:any){
  let c=CATALOGS.get(db as object);
  if(!c){
    c={questionStamp:'',questionRows:[],routeStamp:'',routeRows:[],topicRouteRows:[],routeById:new Map<string,any>()};
    CATALOGS.set(db as object,c);
  }
  return c;
}
function activeQuestionRows(db:any){
  const s=statements(db);const c=catalog(db);const row:any=s.questionStamp.get();
  const stamp=`${row.c}|${row.qmax}|${row.fmax}`;
  if(c.questionStamp!==stamp){c.questionStamp=stamp;c.questionRows=s.questions.all();}
  return c.questionRows as any[];
}
function routeMetadata(db:any,routeId:string){
  const s=statements(db);const c=catalog(db);const row:any=s.routeStamp.get();const tr:any=s.topicRouteStamp.get();
  const stamp=`${row.c}|${row.m}|${tr.lc}|${tr.lm}|${tr.ec}|${tr.em}`;
  if(c.routeStamp!==stamp){
    c.routeStamp=stamp;c.routeRows=s.routeLinks.all();c.topicRouteRows=s.topicRouteRows.all();c.routeById.clear();
  }
  const cached=c.routeById.get(routeId);if(cached)return cached;
  const strengths=new Map<string,string>();const routeFamilies=new Set<string>();const boundFamilies=new Set<string>();
  for(const link of c.routeRows as any[]){
    boundFamilies.add(link.question_family_id);
    if(link.route_id!==routeId)continue;
    routeFamilies.add(link.question_family_id);
    const key=`${link.question_family_id}|${link.evidence_ref_id}`;
    const current=strengths.get(key);
    if(!current||(STRENGTH_SCORE[link.strength]??0)>(STRENGTH_SCORE[current]??0))strengths.set(key,link.strength);
  }
  const topicRouteFamilies=new Set<string>();
  for(const row of c.topicRouteRows as any[])if(row.route_id===routeId)topicRouteFamilies.add(row.question_family_id);
  const metadata={strengths,routeFamilies,boundFamilies,topicRouteFamilies};
  c.routeById.set(routeId,metadata);
  return metadata;
}
function preferredEvidenceFromTags(tags:string|null|undefined){
  return String(tags??'').match(/evidence:([^\s]+)/)?.[1]??null;
}
function ftsHits(db:any,queryText?:string){
  const hits=new Map<string,number>();
  const normalized=String(queryText??'').normalize('NFKC').trim();
  if(!normalized)return hits;
  const compact=normalized.replace(/[\s，。？！、,:;；：]/g,'');
  const grams=[...new Set(Array.from({length:Math.max(0,compact.length-2)},(_,i)=>compact.slice(i,i+3)))].slice(0,20);
  if(!grams.length)return hits;
  try{
    const expression=grams.map((gram)=>`"${gram.replaceAll('"','')}"`).join(' OR ');
    const rows:any[]=statements(db).fts.all(expression) as any[];
    for(const row of rows){
      const haystack=`${row.text??''} ${row.tags??''} ${row.signal_terms??''}`.normalize('NFKC');
      const score=grams.reduce((sum,gram)=>sum+(haystack.includes(gram)?1:0),0);
      if(score>0)hits.set(row.item_id,score);
    }
  }catch{}
  return hits;
}
function recentSessionState(db:any,sessionId?:string){
  if(!sessionId)return{asked:new Set<string>(),familyCounts:new Map<string,number>(),evidenceCounts:new Map<string,number>(),closedSignals:new Set<string>()};
  const s=statements(db);
  const askedRows:any[]=s.asked.all(sessionId) as any[];
  const turns:any[]=s.turns.all(sessionId) as any[];
  const asked=new Set<string>(askedRows.map((row)=>row.question_id));
  const familyCounts=new Map<string,number>();
  const evidenceCounts=new Map<string,number>();
  for(const turn of turns){
    if(turn.question_family_id)familyCounts.set(turn.question_family_id,(familyCounts.get(turn.question_family_id)??0)+1);
    try{for(const ev of JSON.parse(turn.selected_evidence_json??'[]'))evidenceCounts.set(ev,(evidenceCounts.get(ev)??0)+1);}catch{}
  }
  const closedRows:any[]=s.closedSignals.all(sessionId) as any[];
  return{asked,familyCounts,evidenceCounts,closedSignals:new Set(closedRows.map((row)=>row.signal_id))};
}

export function retrieveInterviewCandidates(db:any,input:RetrievalInput){
  const limit=Math.max(1,Math.min(input.limit??5,20));
  const state=recentSessionState(db,input.sessionId);
  const lexical=ftsHits(db,input.queryText);
  const route=routeMetadata(db,input.routeId);
  const graphTargets=new Map<string,number>();
  if(input.currentFamilyId){
    const wanted=input.intent==='FOLLOW_UP'?'FOLLOW_UP':input.intent==='CHALLENGE'?'CHALLENGE':null;
    for(const row of statements(db).graph.all(input.currentFamilyId) as any[]){
      if(!wanted||row.edge_type===wanted)graphTargets.set(row.to_question_family_id,row.priority);
    }
  }
  const candidates:any[]=[];
  for(const row of activeQuestionRows(db)){
    if(route.boundFamilies.has(row.question_family_id)&&!route.routeFamilies.has(row.question_family_id))continue;
    if(/^fq[5-8]\./.test(String(row.question_id))&&!route.topicRouteFamilies.has(row.question_family_id))continue;
    if(input.preferredFamilyId&&row.question_family_id!==input.preferredFamilyId)continue;
    if(state.asked.has(row.question_id)||state.closedSignals.has(row.signal_id))continue;
    if(input.targetSignalId&&!state.closedSignals.has(input.targetSignalId)&&row.signal_id!==input.targetSignalId)continue;

    let score=0;const reasons:string[]=['ACTIVE_HARD_FILTER'];
    if(input.targetSignalId===row.signal_id){score+=100;reasons.push('TARGET_SIGNAL');}
    const graphPriority=graphTargets.get(row.question_family_id);
    if(graphPriority!=null){score+=180+graphPriority;reasons.push('GRAPH_FOLLOW_UP');}
    const ftsScore=lexical.get(row.question_id)??0;
    if(ftsScore>0){score+=ftsScore*18;reasons.push('FTS');}
    const preferredEvidence=preferredEvidenceFromTags(row.tags);
    if(preferredEvidence){
      const strength=route.strengths.get(`${row.question_family_id}|${preferredEvidence}`);
      if(strength){score+=STRENGTH_SCORE[strength]??0;reasons.push(`ROUTE_EVIDENCE_${strength}`);}
    }
    const familyUse=state.familyCounts.get(row.question_family_id)??0;
    const evidenceUse=preferredEvidence?(state.evidenceCounts.get(preferredEvidence)??0):0;
    if(familyUse>=2){score-=200;reasons.push('DIVERSITY_PENALTY');}
    else if(familyUse===1){score-=40;reasons.push('RECENT_FAMILY_PENALTY');}
    if(evidenceUse>=2){score-=60;if(!reasons.includes('DIVERSITY_PENALTY'))reasons.push('DIVERSITY_PENALTY');}

    candidates.push({
      questionId:row.question_id,familyId:row.question_family_id,signalId:row.signal_id,
      text:row.canonical_text,lifecycle:row.lifecycle,preferredEvidenceId:preferredEvidence,score,reasons,
    });
  }
  candidates.sort((a,b)=>b.score-a.score||a.questionId.localeCompare(b.questionId));
  return{candidates:candidates.slice(0,limit),meta:{strategy:'HARD_FILTER>SESSION>GRAPH>FTS5>RULE_RERANK>DIVERSITY',vectorUsed:false}};
}

const GOLDEN_EVAL=[
  {expected:'q.build.1',input:{routeId:'route.ai-agent-devtools',queryText:'现成框架为什么不直接用'}},
  {expected:'q.build.2',input:{routeId:'route.ai-agent-devtools',queryText:'判断自研还是复用'}},
  {expected:'q.ownership.devtools',input:{routeId:'route.ai-agent-devtools',targetSignalId:'signal.ownership'}},
  {expected:'q.ownership.platform',input:{routeId:'route.tob-fde',targetSignalId:'signal.ownership'}},
  {expected:'q.failure.workflow',input:{routeId:'route.ai-agent-devtools',queryText:'长任务通信为什么需要重做'}},
  {expected:'q.failure.migration',input:{routeId:'route.advanced-fe-fullstack',queryText:'共享平台迁移收尾问题'}},
  {expected:'q.unknown.1',input:{routeId:'route.ai-agent-devtools',queryText:'没有做过的系统怎么验证'}},
  {expected:'q.unknown.2',input:{routeId:'route.ai-agent-devtools',queryText:'不确定一个技术结论怎么处理'}},
] as const;

export function evaluateRetrievalGoldenSet(db:any){
  let top1Hits=0;let explained=0;
  const rows=GOLDEN_EVAL.map((item)=>{
    const result=retrieveInterviewCandidates(db,{...item.input,limit:3});
    const top=result.candidates[0];const hit=top?.questionId===item.expected;
    if(hit)top1Hits++;if(top?.reasons?.length)explained++;
    return{expected:item.expected,actual:top?.questionId??null,hit,score:top?.score??null,reasons:top?.reasons??[]};
  });
  return{total:rows.length,top1Hits,explanationCoverage:rows.length?explained/rows.length:0,vectorUsed:false,rows};
}
