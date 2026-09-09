import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const DATA_FILE=resolve(REPO_ROOT,'app/server/data/learning/course/course-units-v1.json');
const corpus=JSON.parse(readFileSync(DATA_FILE,'utf8'));
const courses:any[]=corpus.items??[];
const byId=new Map(courses.map((course:any)=>[course.id,course]));
const byTitle=new Map(courses.map((course:any)=>[String(course.title).toLowerCase(),course]));
const STATES=['UNSEEN','RECOGNIZE','EXPLAIN','CONNECT','APPLY','DEBUG','DESIGN','INTERVIEW_READY'] as const;
const stateSet=new Set<string>(STATES);

export const COURSE_LEARNING_TOOL_CONTRACTS={
  'learning.list_course_units':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.course_lookup':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.plan_course_path':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.record_course_progress':{sideEffect:'RECORD_LEARNING_PROGRESS',idempotentBy:'request_id',careerFactsMutable:false},
  'learning.get_course_progress':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.list_due_course_reviews':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
  'learning.get_course_coverage':{sideEffect:'READ_ONLY',idempotentBy:null,careerFactsMutable:false},
} as const;

function learningError(code:string){ const error:any=new Error(code); error.code=code; return error; }
function resolveCourse(value:string){
  const key=String(value??'').trim();
  if(!key) throw learningError('LEARNING_COURSE_NOT_FOUND');
  const course=byId.get(key)??byTitle.get(key.toLowerCase());
  if(!course) throw learningError('LEARNING_COURSE_NOT_FOUND');
  return course;
}
function summaryView(course:any){
  return {id:course.id,title:course.title,chains:course.chains??[],priority:course.priority,sourceDoc:course.sourceDoc,
    prerequisiteUnitIds:course.prerequisiteUnitIds??[],linkedTermCount:(course.linkedTerms??[]).length,
    unresolvedConcepts:course.unresolvedConcepts??[],contentStatus:course.contentStatus};
}
function courseView(course:any){
  return {...summaryView(course),why:course.why,mentalModel:course.mentalModel,contentSections:course.contentSections??[],
    interviewTransfer:course.interviewTransfer??[],failurePractice:course.failurePractice??[],evidenceBoundary:course.evidenceBoundary??'',
    officialVerification:course.officialVerification??'',linkedTerms:course.linkedTerms??[],reviewedAt:course.reviewedAt??null};
}
function currentProgress(db:any,courseId:string){
  const row:any=db.prepare(`SELECT course_id,state,confidence,source_type,source_ref,next_review_at,updated_at
    FROM learning_course_progress WHERE course_id=?`).get(courseId);
  return row?{courseId:row.course_id,state:row.state,confidence:row.confidence,sourceType:row.source_type,sourceRef:row.source_ref,nextReviewAt:row.next_review_at,updatedAt:row.updated_at}
    :{courseId,state:'UNSEEN',confidence:0,sourceType:null,sourceRef:null,nextReviewAt:null,updatedAt:null};
}

export function listLearningCourseUnits(_db:any,input:{chain?:string;priority?:string}={}){
  let items=courses;
  if(input.chain) items=items.filter((course:any)=>(course.chains??[]).includes(String(input.chain)));
  if(input.priority) items=items.filter((course:any)=>course.priority===String(input.priority));
  return {count:items.length,items:items.map(summaryView)};
}

export function lookupLearningCourse(db:any,input:{course:string}){
  const course=resolveCourse(input.course);
  return {course:courseView(course),progress:currentProgress(db,course.id)};
}

export function planLearningCoursePath(_db:any,input:{target:string}){
  const target=resolveCourse(input.target);
  const visiting=new Set<string>(), visited=new Set<string>(), ordered:any[]=[];
  const visit=(course:any)=>{
    if(visited.has(course.id)) return;
    if(visiting.has(course.id)) throw learningError('LEARNING_COURSE_PREREQUISITE_CYCLE');
    visiting.add(course.id);
    for(const id of course.prerequisiteUnitIds??[]){
      const prereq=byId.get(id); if(!prereq) throw learningError('LEARNING_COURSE_PREREQUISITE_NOT_FOUND');
      visit(prereq);
    }
    visiting.delete(course.id); visited.add(course.id); ordered.push(summaryView(course));
  };
  visit(target);
  return {target:summaryView(target),path:ordered};
}

export function recordLearningCourseProgress(db:any,input:{requestId:string;course:string;state:string;confidence?:number;note:string;sourceType:string;sourceRef?:string;nextReviewAt?:string|null},now=new Date().toISOString()){
  const course=resolveCourse(input.course), state=String(input.state??'');
  if(!stateSet.has(state)) throw learningError('LEARNING_STATE_INVALID');
  const confidence=Number(input.confidence??0);
  if(!Number.isFinite(confidence)||confidence<0||confidence>1) throw learningError('LEARNING_CONFIDENCE_INVALID');
  if(!String(input.requestId??'').trim()) throw learningError('LEARNING_REQUEST_ID_REQUIRED');
  if(!String(input.note??'').trim()) throw learningError('LEARNING_PROGRESS_NOTE_REQUIRED');
  if(!String(input.sourceType??'').trim()) throw learningError('LEARNING_PROGRESS_SOURCE_REQUIRED');
  const existing:any=db.prepare(`SELECT course_id,to_state,confidence,note,source_type,source_ref,next_review_at,response_json
    FROM learning_course_progress_events WHERE request_id=?`).get(input.requestId);
  if(existing){
    const same=existing.course_id===course.id&&existing.to_state===state&&Number(existing.confidence)===confidence&&existing.note===input.note&&existing.source_type===input.sourceType&&(existing.source_ref??null)===(input.sourceRef??null)&&(existing.next_review_at??null)===(input.nextReviewAt??null);
    if(!same) throw learningError('REQUEST_ID_OPERATION_MISMATCH');
    return JSON.parse(existing.response_json);
  }
  const before=currentProgress(db,course.id), eventId=`course-progress.${randomUUID()}`;
  const current={courseId:course.id,state,confidence,sourceType:input.sourceType,sourceRef:input.sourceRef??null,nextReviewAt:input.nextReviewAt??null,updatedAt:now};
  const response={course:summaryView(course),previousState:before.state,current,eventId};
  db.exec('BEGIN;');
  try{
    db.prepare(`INSERT INTO learning_course_progress_events(id,request_id,course_id,from_state,to_state,confidence,note,source_type,source_ref,next_review_at,response_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(eventId,input.requestId,course.id,before.state,state,confidence,input.note,input.sourceType,input.sourceRef??null,input.nextReviewAt??null,JSON.stringify(response),now);
    db.prepare(`INSERT INTO learning_course_progress(course_id,state,confidence,source_type,source_ref,next_review_at,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(course_id) DO UPDATE SET state=excluded.state,confidence=excluded.confidence,source_type=excluded.source_type,source_ref=excluded.source_ref,next_review_at=excluded.next_review_at,updated_at=excluded.updated_at`)
      .run(course.id,state,confidence,input.sourceType,input.sourceRef??null,input.nextReviewAt??null,now);
    db.exec('COMMIT;'); return response;
  }catch(error){ try{db.exec('ROLLBACK;')}catch{} throw error; }
}

export function getLearningCourseProgress(db:any,input:{course:string;historyLimit?:number}){
  const course=resolveCourse(input.course), limit=Math.max(1,Math.min(100,Number(input.historyLimit??20)));
  const history:any[]=db.prepare(`SELECT id,request_id,from_state,to_state,confidence,note,source_type,source_ref,next_review_at,created_at
    FROM learning_course_progress_events WHERE course_id=? ORDER BY created_at DESC,id DESC LIMIT ?`).all(course.id,limit) as any[];
  return {course:summaryView(course),current:currentProgress(db,course.id),history:history.map(row=>({eventId:row.id,requestId:row.request_id,fromState:row.from_state,toState:row.to_state,confidence:row.confidence,note:row.note,sourceType:row.source_type,sourceRef:row.source_ref,nextReviewAt:row.next_review_at,createdAt:row.created_at}))};
}

export function listLearningDueCourseReviews(db:any,input:{now?:string;limit?:number}={}){
  const now=input.now??new Date().toISOString(), limit=Math.max(1,Math.min(100,Number(input.limit??20)));
  const rows:any[]=db.prepare(`SELECT course_id,state,confidence,source_type,source_ref,next_review_at,updated_at
    FROM learning_course_progress WHERE next_review_at IS NOT NULL AND next_review_at<=?
    ORDER BY next_review_at,course_id LIMIT ?`).all(now,limit) as any[];
  return {now,count:rows.length,items:rows.map(row=>({course:summaryView(byId.get(row.course_id)),progress:{courseId:row.course_id,state:row.state,confidence:row.confidence,sourceType:row.source_type,sourceRef:row.source_ref,nextReviewAt:row.next_review_at,updatedAt:row.updated_at}}))};
}

export function getCourseCoverage(){
  return {schemaVersion:corpus.schemaVersion,targetUnits:7,materializedUnits:courses.length,coverageRatio:courses.length/7,
    linkedCanonicalTerms:new Set(courses.flatMap((course:any)=>(course.linkedTerms??[]).map((term:any)=>term.termId))).size,
    unresolvedConcepts:corpus.unresolvedConcepts??[]};
}

export function getCourseLearningStatus(){
  return {schemaVersion:corpus.schemaVersion,units:courses.length,coverage:getCourseCoverage(),states:[...STATES]};
}
