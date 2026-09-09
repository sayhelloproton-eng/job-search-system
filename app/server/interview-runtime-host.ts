import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './db.ts';
import { ensureInterviewRuntimeReady, executeInterviewRuntimeCommand } from './interview-runtime-cli.ts';

const json=(res:any,body:any,status=200)=>{
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(body));
};

async function readJson(req:any){
  let raw='';
  for await (const chunk of req){
    raw+=chunk;
    if(raw.length>65536) throw Object.assign(new Error('INTERVIEW_RUNTIME_REQUEST_TOO_LARGE'),{code:'INTERVIEW_RUNTIME_REQUEST_TOO_LARGE'});
  }
  try { return JSON.parse(raw||'{}'); }
  catch { throw Object.assign(new Error('INTERVIEW_RUNTIME_REQUEST_INVALID_JSON'),{code:'INTERVIEW_RUNTIME_REQUEST_INVALID_JSON'}); }
}

function runtimeIntentForDirector(action:string){
  if(action==='PROBE_DEPTH') return 'FOLLOW_UP';
  if(action==='CHALLENGE_TRADEOFF'||action==='CROSS_CHECK_CLAIM') return 'CHALLENGE';
  if(action==='CLARIFY') return 'CLARIFY';
  return 'ASK';
}

export function createInterviewRuntimeHost(options:any={}){
  const db=openDatabase(options.dbPath ?? process.env.INTERVIEW_DB_PATH);
  ensureInterviewRuntimeReady(db);
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/','http://127.0.0.1');
      if(req.method==='GET'&&url.pathname==='/health'){
        return json(res,{ok:true,result:executeInterviewRuntimeCommand(db,{op:'status'})});
      }
      if(req.method==='POST'&&url.pathname==='/tool'){
        const request=await readJson(req);
        return json(res,{ok:true,result:executeInterviewRuntimeCommand(db,request)});
      }
      if(req.method==='POST'&&(url.pathname==='/interview/continue'||url.pathname==='/voice/continue')){
        const request=await readJson(req);
        const observed=executeInterviewRuntimeCommand(db,{op:'interview.observe_answer',input:{
          requestId:request.observeRequestId,sessionId:request.sessionId,turnId:request.turnId,
          answerObservation:request.answerObservation??{}
        }});
        const directorEnabled=Boolean(db.prepare('SELECT 1 ok FROM interview_director_session_plans WHERE session_id=?').get(request.sessionId));
        if(directorEnabled){
          const director=executeInterviewRuntimeCommand(db,{op:'interview.director_decide',input:{
            requestId:request.directorRequestId,sessionId:request.sessionId,sourceTurnId:request.turnId,
            explicitUnknown:request.explicitUnknown===true,
            ...(request.reasoningChallenge?{reasoningChallenge:request.reasoningChallenge}:{}),
            ...(request.hypothesisUpdate?{hypothesisUpdate:request.hypothesisUpdate}:{}),
            ...(request.hypothesisResolution?{hypothesisResolution:request.hypothesisResolution}:{})
          }});
          if(director.action==='CLOSE_ROUND') return json(res,{ok:true,result:{observed,director,next:null}});
          const next=executeInterviewRuntimeCommand(db,{op:'interview.next_turn',input:{
            requestId:request.nextRequestId,sessionId:request.sessionId,
            desiredAction:runtimeIntentForDirector(director.action),
            targetSignalId:director.targetSignalId??undefined,
            preferredFamilyId:director.preferredFamilyId??undefined,
            phaseTransition:director.action==='ADVANCE_PHASE'&&director.nextPhaseId==='CANDIDATE_QUESTIONS'?'CANDIDATE_QUESTIONS':undefined
          }});
          return json(res,{ok:true,result:{observed,director,next}});
        }
        const next=executeInterviewRuntimeCommand(db,{op:'interview.next_turn',input:{
          requestId:request.nextRequestId,sessionId:request.sessionId,desiredAction:request.desiredAction??'FOLLOW_UP'
        }});
        return json(res,{ok:true,result:{observed,next}});
      }
      return json(res,{ok:false,error:{code:'NOT_FOUND'}},404);
    }catch(error:any){
      const code=error?.code||error?.message||'INTERVIEW_RUNTIME_ERROR';
      return json(res,{ok:false,error:{code,message:error?.message??code}},400);
    }
  });
  return {server,db,close:()=>new Promise<void>((done)=>server.close(()=>{db.close();done();}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {server}=createInterviewRuntimeHost();
  const port=Number(process.env.INTERVIEW_RUNTIME_PORT||4318);
  server.listen(port,'127.0.0.1',()=>{
    process.stdout.write(`Interview Runtime Host: http://127.0.0.1:${port}\n`);
  });
}