import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupLearningTerm } from './learning-terminology-runtime.ts';

const REPO_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const DATA_ROOT=resolve(REPO_ROOT,'app/server/data/learning/terminology');
const topicMapData=JSON.parse(readFileSync(resolve(DATA_ROOT,'interview-topic-term-map-v1.json'),'utf8'));
const corpus=JSON.parse(readFileSync(resolve(DATA_ROOT,'terms-v1.json'),'utf8'));
const aliasData=JSON.parse(readFileSync(resolve(DATA_ROOT,'aliases-v1.json'),'utf8'));
const topicMap=new Map(topicMapData.mappings.map((row:any)=>[row.topicId,row]));
const terms:any[]=corpus.items;

export const LEARNING_FEEDBACK_TOOL_CONTRACTS={
  'learning.plan_interview_handoff':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.map_jd_terms':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

function integrationError(code:string){ const error:any=new Error(code); error.code=code; return error; }
function topicRowsForTarget(db:any,targetType:string,targetId:string){
  if(targetType==='TOPIC') return db.prepare(`SELECT id topic_id,name,domain_id FROM interview_knowledge_topics WHERE id=? AND lifecycle='ACTIVE'`).all(targetId) as any[];
  if(targetType==='QUESTION_FAMILY') return db.prepare(`SELECT t.id topic_id,t.name,t.domain_id,l.relation_type
    FROM interview_family_topic_links l JOIN interview_knowledge_topics t ON t.id=l.topic_id
    WHERE l.question_family_id=? AND l.lifecycle='ACTIVE' AND t.lifecycle='ACTIVE'
    ORDER BY CASE l.relation_type WHEN 'PRIMARY' THEN 0 ELSE 1 END,t.id`).all(targetId) as any[];
  if(targetType==='LEARNING'){
    const topic:any=db.prepare(`SELECT id FROM interview_knowledge_topics WHERE id=? AND lifecycle='ACTIVE'`).get(targetId);
    return topic?topicRowsForTarget(db,'TOPIC',targetId):topicRowsForTarget(db,'QUESTION_FAMILY',targetId);
  }
  return [];
}export function planInterviewLearningHandoff(db:any,input:{trainingEventId:string}){
  const row:any=db.prepare(`SELECT t.id,t.status,t.next_action,t.target_ref,
    f.target_type,f.target_id,f.observation,
    s.route_id,s.scene_id,s.job_id
    FROM interview_training_events t
    JOIN interview_feedback_events f ON f.id=t.feedback_event_id
    LEFT JOIN interview_sessions s ON s.id=t.session_id
    WHERE t.id=?`).get(input.trainingEventId);
  if(!row) throw integrationError('LEARNING_HANDOFF_NOT_FOUND');
  if(row.next_action!=='LEARNING') throw integrationError('LEARNING_HANDOFF_ACTION_MISMATCH');
  const targetId=row.target_id??row.target_ref;
  const topics=topicRowsForTarget(db,row.target_type,targetId)
    .map((topic:any)=>({topicId:topic.topic_id,name:topic.name,domainId:topic.domain_id,relationType:topic.relation_type??'PRIMARY',mapping:topicMap.get(topic.topic_id)??null}));
  if(!topics.length) throw integrationError('LEARNING_HANDOFF_TOPIC_UNRESOLVED');
  const technical=topics.filter((x:any)=>x.mapping?.mode==='TERM_GRAPH');
  const selected=technical.length?technical:topics;
  const seen=new Set<string>(), recommendedTerms:any[]=[];
  for(const topic of selected){
    for(const ref of [...(topic.mapping?.terms??[])].sort((a:any,b:any)=>a.rank-b.rank)){
      if(seen.has(ref.termId)) continue;
      seen.add(ref.termId);
      const looked=lookupLearningTerm(db,{term:ref.canonicalName});
      recommendedTerms.push({topicId:topic.topicId,rank:ref.rank,term:looked.term,progress:looked.progress});
    }
  }
  return {
    trainingEventId:row.id,
    classification:technical.length?'TERM_GRAPH':'NON_TERMINOLOGY',
    topics:selected.map((x:any)=>({topicId:x.topicId,name:x.name,domainId:x.domainId,relationType:x.relationType,mode:x.mapping?.mode??'UNMAPPED'})),
    recommendedTerms,
    source:{routeId:row.route_id??null,sceneId:row.scene_id??null,jobId:row.job_id??null,observation:row.observation??null}
  };
}
function escapeRegex(value:string){ return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function phrasePattern(value:string){
  const escaped=escapeRegex(value);
  return /^[a-z0-9_.+/-]+$/i.test(value)?new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`,'i'):new RegExp(escaped,'i');
}

export function mapJdTerms(db:any,input:{text?:string;jobId?:string;limit?:number}){
  let text=String(input.text??'');
  let source:any={type:'TEXT'};
  if(!text.trim()&&input.jobId){
    const job:any=db.prepare('SELECT id,title,company,jd_text FROM jobs WHERE id=?').get(input.jobId);
    if(!job) throw integrationError('LEARNING_JD_NOT_FOUND');
    text=String(job.jd_text??'');
    source={type:'JOB',jobId:job.id,title:job.title,company:job.company};
  }
  if(!text.trim()) throw integrationError('LEARNING_JD_TEXT_REQUIRED');
  const aliasByCanonical=new Map<string,string[]>();
  for(const row of aliasData.aliases){
    const key=String(row.canonical).toLowerCase();
    const list=aliasByCanonical.get(key)??[]; list.push(String(row.alias)); aliasByCanonical.set(key,list);
  }
  const hits:any[]=[];
  for(const term of terms){
    const candidates=[term.canonicalName,...(term.aliases??[]),...(aliasByCanonical.get(term.canonicalName.toLowerCase())??[])];
    const matched=candidates.find((candidate:string)=>candidate.length>=2&&phrasePattern(candidate).test(text));
    if(!matched) continue;
    const looked=lookupLearningTerm(db,{term:term.canonicalName});
    hits.push({term:looked.term,progress:looked.progress,matchedText:matched,matchType:matched.toLowerCase()===term.canonicalName.toLowerCase()?'CANONICAL':'ALIAS'});
  }
  const priority=(band:string)=>band==='P0'?0:band==='P0/P1'?1:band==='P1'?2:3;
  hits.sort((a,b)=>priority(a.term.priority)-priority(b.term.priority)||a.term.canonicalName.localeCompare(b.term.canonicalName));
  const limit=Math.max(1,Math.min(200,Number(input.limit??100)));
  return {source,count:Math.min(limit,hits.length),items:hits.slice(0,limit)};
}
