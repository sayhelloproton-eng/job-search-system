import { readFileSync } from 'node:fs';
import { openDatabase } from './db.ts';
import { registerFormalQuestionCorpusWave4 } from './interview-formal-corpus-wave4.ts';
import { registerFormalQuestionCorpusP5 } from './interview-formal-corpus-p5.ts';
import { registerFormalQuestionCorpusP5B } from './interview-formal-corpus-p5b.ts';
import { registerFormalQuestionCorpusSocialGapV1 } from './interview-formal-corpus-social-gap-v1.ts';
import { registerFormalQuestionCorpusSocialEnhancementV1 } from './interview-formal-corpus-social-enhancement-v1.ts';
import {
  INTERVIEW_RUNTIME_TOOL_CONTRACTS,
  startInterviewSession,
  nextInterviewTurn,
  observeInterviewAnswer,
  resolveInterviewEvidence,
} from './interview-voice-runtime.ts';
import {
  INTERVIEW_FEEDBACK_TOOL_CONTRACTS,
  finishInterviewSession,
  recordInterviewFeedback,
  listInterviewTrainingActions,
} from './interview-feedback.ts';
import {
  INTERVIEW_GROWTH_TOOL_CONTRACTS,
  recordRoundDebrief,
  appendAnswerVersion,
  recordGrowthObservation,
  selectBestAnswer,
  enqueueGrowthReview,
  getGrowthProfile,
} from './interview-growth.ts';
import { INTERVIEW_ADAPTIVE_TOOL_CONTRACTS, planAdaptiveTraining, completeAdaptiveReview } from './interview-adaptive-training.ts';
import { INTERVIEW_KNOWLEDGE_TOOL_CONTRACTS, registerInterviewKnowledgeTaxonomy, auditInterviewKnowledgeCoverage } from './interview-knowledge-coverage.ts';
import { LEARNING_BRIDGE_TOOL_CONTRACTS, listInterviewLearningHandoffs, recordInterviewLearningHandoffResult } from './interview-learning-bridge.ts';
import {
  TERMINOLOGY_LEARNING_TOOL_CONTRACTS,
  lookupLearningTerm,
  searchLearningTerms,
  planLearningTermPath,
  recordLearningTermProgress,
  getLearningTermProgress,
  listLearningDueReviews,
  getTermCardCoverage,
  getTerminologyLearningStatus,
} from './learning-terminology-runtime.ts';
import {
  COURSE_LEARNING_TOOL_CONTRACTS,
  listLearningCourseUnits,
  lookupLearningCourse,
  planLearningCoursePath,
  recordLearningCourseProgress,
  getLearningCourseProgress,
  listLearningDueCourseReviews,
  getCourseCoverage,
  getCourseLearningStatus,
} from './learning-course-runtime.ts';
import {
  LEARNING_FEEDBACK_TOOL_CONTRACTS,
  planInterviewLearningHandoff,
  mapJdTerms,
} from './learning-feedback-integration.ts';
import {
  TERMINOLOGY_CALIBRATION_TOOL_CONTRACTS,
  recordTermCandidate,
  listTermCandidates,
  auditTermFreshness,
  recordTermCalibration,
} from './learning-terminology-calibration.ts';
import {
  INTERVIEW_DIRECTOR_TOOL_CONTRACTS,
  prepareInterviewDirectorSession,
  decideInterviewDirector,
  getInterviewDirectorState,
  finalizeInterviewDirectorRound,
} from './interview-director.ts';
import { getDirectorProfileSummary } from './interview-director-profiles.ts';

const HOT_OPERATIONS = Object.keys(INTERVIEW_RUNTIME_TOOL_CONTRACTS);
const FEEDBACK_OPERATIONS = Object.keys(INTERVIEW_FEEDBACK_TOOL_CONTRACTS);
const GROWTH_OPERATIONS = Object.keys(INTERVIEW_GROWTH_TOOL_CONTRACTS);
const ADAPTIVE_OPERATIONS = Object.keys(INTERVIEW_ADAPTIVE_TOOL_CONTRACTS);
const KNOWLEDGE_OPERATIONS = Object.keys(INTERVIEW_KNOWLEDGE_TOOL_CONTRACTS);
const LEARNING_BRIDGE_OPERATIONS = Object.keys(LEARNING_BRIDGE_TOOL_CONTRACTS);
const TERMINOLOGY_LEARNING_OPERATIONS = Object.keys(TERMINOLOGY_LEARNING_TOOL_CONTRACTS);
const COURSE_LEARNING_OPERATIONS = Object.keys(COURSE_LEARNING_TOOL_CONTRACTS);
const LEARNING_FEEDBACK_OPERATIONS = Object.keys(LEARNING_FEEDBACK_TOOL_CONTRACTS);
const TERMINOLOGY_CALIBRATION_OPERATIONS = Object.keys(TERMINOLOGY_CALIBRATION_TOOL_CONTRACTS);
const DIRECTOR_OPERATIONS = Object.keys(INTERVIEW_DIRECTOR_TOOL_CONTRACTS);
const ALLOWED_OPERATIONS = [...HOT_OPERATIONS,...FEEDBACK_OPERATIONS,...GROWTH_OPERATIONS,...ADAPTIVE_OPERATIONS,...KNOWLEDGE_OPERATIONS,...LEARNING_BRIDGE_OPERATIONS,...TERMINOLOGY_LEARNING_OPERATIONS,...COURSE_LEARNING_OPERATIONS,...LEARNING_FEEDBACK_OPERATIONS,...TERMINOLOGY_CALIBRATION_OPERATIONS,...DIRECTOR_OPERATIONS];

function runtimeError(code:string,message=code){
  const error:any=new Error(message);
  error.code=code;
  return error;
}

const KNOWLEDGE_READY = new WeakSet<object>();

export function ensureInterviewRuntimeReady(db:any,now=new Date().toISOString()){
  const ready=db.prepare("SELECT 1 ok FROM interview_questions WHERE id='fq4.recruiter.01' AND lifecycle='ACTIVE'").get();
  if(!ready) registerFormalQuestionCorpusWave4(db,now);
  const expandedReady=db.prepare("SELECT 1 ok FROM interview_questions WHERE id='fq5.agent-mcp.01' AND lifecycle='ACTIVE'").get();
  if(!expandedReady) registerFormalQuestionCorpusP5(db,now);
  const coreExpandedReady=db.prepare("SELECT 1 ok FROM interview_questions WHERE id='fq6.coding-ts.01' AND lifecycle='ACTIVE'").get();
  if(!coreExpandedReady) registerFormalQuestionCorpusP5B(db,now);
  const socialGapReady=db.prepare("SELECT 1 ok FROM interview_questions WHERE id='fq7.agent-skill.01' AND lifecycle='ACTIVE'").get();
  if(!socialGapReady) registerFormalQuestionCorpusSocialGapV1(db,now);
  const socialEnhancementReady=db.prepare("SELECT 1 ok FROM interview_questions WHERE id='fq8.agent-runtime-loop.01' AND lifecycle='ACTIVE'").get();
  if(!socialEnhancementReady) registerFormalQuestionCorpusSocialEnhancementV1(db,now);
  if(!KNOWLEDGE_READY.has(db as object)){
    registerInterviewKnowledgeTaxonomy(db,now);
    KNOWLEDGE_READY.add(db as object);
  }
}

export function executeInterviewRuntimeCommand(db:any,request:any){
  ensureInterviewRuntimeReady(db);
  const op=String(request?.op??'');
  if(op==='status'){
    const formalQuestions=Number((db.prepare(`SELECT COUNT(*) c FROM interview_questions
      WHERE lifecycle='ACTIVE' AND (id LIKE 'fq1.%' OR id LIKE 'fq2.%' OR id LIKE 'fq3.%' OR id LIKE 'fq4.%')`).get() as any).c);
    const totalActiveQuestions=Number((db.prepare(`SELECT COUNT(*) c FROM interview_questions WHERE lifecycle='ACTIVE' AND id GLOB 'fq[1-8].*'`).get() as any).c);
    return {ready:formalQuestions===42&&totalActiveQuestions===94,formalQuestions,totalActiveQuestions,operations:HOT_OPERATIONS,feedbackOperations:FEEDBACK_OPERATIONS,growthOperations:GROWTH_OPERATIONS,adaptiveOperations:ADAPTIVE_OPERATIONS,knowledgeOperations:KNOWLEDGE_OPERATIONS,learningBridgeOperations:LEARNING_BRIDGE_OPERATIONS,terminologyLearningOperations:TERMINOLOGY_LEARNING_OPERATIONS,terminologyLearningStatus:getTerminologyLearningStatus(),courseLearningOperations:COURSE_LEARNING_OPERATIONS,courseLearningStatus:getCourseLearningStatus(),learningFeedbackOperations:LEARNING_FEEDBACK_OPERATIONS,terminologyCalibrationOperations:TERMINOLOGY_CALIBRATION_OPERATIONS,directorOperations:DIRECTOR_OPERATIONS,directorProfileSummary:getDirectorProfileSummary()};
  }
  if(!ALLOWED_OPERATIONS.includes(op)) throw runtimeError('INTERVIEW_RUNTIME_OPERATION_NOT_ALLOWED');
  const input=request?.input??{};
  switch(op){
    case 'interview.start_session': return startInterviewSession(db,input);
    case 'interview.next_turn': return nextInterviewTurn(db,input);
    case 'interview.observe_answer': return observeInterviewAnswer(db,input);
    case 'interview.resolve_evidence': return resolveInterviewEvidence(db,input);
    case 'interview.record_human_feedback': return recordInterviewFeedback(db,input);
    case 'interview.finish_session': return finishInterviewSession(db,input);
    case 'interview.list_training_actions': return listInterviewTrainingActions(db,input);
    case 'interview.record_round_debrief': return recordRoundDebrief(db,input);
    case 'interview.append_answer_version': return appendAnswerVersion(db,input);
    case 'interview.record_growth_observation': return recordGrowthObservation(db,input);
    case 'interview.select_best_answer': return selectBestAnswer(db,input);
    case 'interview.enqueue_review': return enqueueGrowthReview(db,input);
    case 'interview.get_growth_profile': return getGrowthProfile(db,input);
    case 'interview.plan_training': return planAdaptiveTraining(db,input);
    case 'interview.complete_review': return completeAdaptiveReview(db,input);
    case 'interview.audit_knowledge_coverage': return auditInterviewKnowledgeCoverage(db,input);
    case 'learning.list_interview_handoffs': return listInterviewLearningHandoffs(db,input);
    case 'learning.record_interview_handoff_result': return recordInterviewLearningHandoffResult(db,input);
    case 'learning.term_lookup': return lookupLearningTerm(db,input);
    case 'learning.search_terms': return searchLearningTerms(db,input);
    case 'learning.plan_term_path': return planLearningTermPath(db,input);
    case 'learning.record_term_progress': return recordLearningTermProgress(db,input);
    case 'learning.get_term_progress': return getLearningTermProgress(db,input);
    case 'learning.list_due_reviews': return listLearningDueReviews(db,input);
    case 'learning.get_term_card_coverage': return getTermCardCoverage();
    case 'learning.list_course_units': return listLearningCourseUnits(db,input);
    case 'learning.course_lookup': return lookupLearningCourse(db,input);
    case 'learning.plan_course_path': return planLearningCoursePath(db,input);
    case 'learning.record_course_progress': return recordLearningCourseProgress(db,input);
    case 'learning.get_course_progress': return getLearningCourseProgress(db,input);
    case 'learning.list_due_course_reviews': return listLearningDueCourseReviews(db,input);
    case 'learning.get_course_coverage': return getCourseCoverage();
    case 'learning.plan_interview_handoff': return planInterviewLearningHandoff(db,input);
    case 'learning.map_jd_terms': return mapJdTerms(db,input);
    case 'learning.record_term_candidate': return recordTermCandidate(db,input);
    case 'learning.list_term_candidates': return listTermCandidates(db,input);
    case 'learning.audit_term_freshness': return auditTermFreshness(db,input);
    case 'learning.record_term_calibration': return recordTermCalibration(db,input);
    case 'interview.director_prepare_session': return prepareInterviewDirectorSession(db,input);
    case 'interview.director_decide': return decideInterviewDirector(db,input);
    case 'interview.director_get_state': return getInterviewDirectorState(db,input);
    case 'interview.director_finalize': return finalizeInterviewDirectorRound(db,input);
    default: throw runtimeError('INTERVIEW_RUNTIME_OPERATION_NOT_ALLOWED');
  }
}
function readRequest(){
  const raw=process.argv[2] ?? readFileSync(0,'utf8');
  if(!raw?.trim()) throw runtimeError('INTERVIEW_RUNTIME_REQUEST_REQUIRED');
  try { return JSON.parse(raw); }
  catch { throw runtimeError('INTERVIEW_RUNTIME_REQUEST_INVALID_JSON'); }
}

function main(){
  const db=openDatabase(process.env.INTERVIEW_DB_PATH);
  try{
    const result=executeInterviewRuntimeCommand(db,readRequest());
    process.stdout.write(`${JSON.stringify({ok:true,result})}\n`);
  }catch(error:any){
    const code=error?.code || error?.message || 'INTERVIEW_RUNTIME_ERROR';
    process.stdout.write(`${JSON.stringify({ok:false,error:{code,message:error?.message??code}})}\n`);
    process.exitCode=1;
  }finally{
    db.close();
  }
}

const isEntrypoint=process.argv[1]?.endsWith('/interview-runtime-cli.ts');
if(isEntrypoint) main();