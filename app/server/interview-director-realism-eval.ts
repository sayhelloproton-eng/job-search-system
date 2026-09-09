export const DIRECTOR_REALISM_FIXTURE_CATALOG_V1 = [
  ['TP-DIR6-001','STOP_DISCIPLINE'],
  ['TP-DIR6-002','PROBE_COHERENCE'],
  ['TP-DIR6-003','PROBE_COHERENCE'],
  ['TP-DIR6-004','TRUTH_RISK_PRIORITY'],
  ['TP-DIR6-005','EXPLICIT_UNKNOWN_DISCIPLINE'],
  ['TP-DIR6-006','ANTI_SCRIPT_REASONING_CHALLENGE'],
  ['TP-DIR6-007','PHASE_DISCIPLINE'],
  ['TP-DIR6-008','ROLE_DIFFERENTIATION'],
  ['TP-DIR6-009','NO_COACHING_LEAK'],
  ['TP-DIR6-010','REPLAY_EXPLAINABILITY'],
  ['TP-DIR6-011','NO_PERSONA_BIAS'],
  ['TP-DIR6-012','FAIL_CLOSED_SUMMARY'],
] as const;

export function projectDirectorSemanticDecision(decision:any){
  return {
    phaseId:decision.phaseId,
    action:decision.action,
    targetSignalId:decision.targetSignalId,
    preferredFamilyId:decision.preferredFamilyId,
    reasonCodes:[...(decision.reasonCodes??[])],
    nextPhaseId:decision.nextPhaseId,
    elapsedSeconds:decision.elapsedSeconds,
    remainingSeconds:decision.remainingSeconds,
  };
}
export function summarizeDirectorRealism(results:Array<{id:string;pass:boolean}>){
  const failed=results.filter(x=>!x.pass).map(x=>x.id);
  return {
    pass:results.length>0&&failed.length===0,
    total:results.length,
    passed:results.length-failed.length,
    failed,
  };
}
