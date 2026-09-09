import { registerAuditedInterviewSources, compileInterviewDocument } from './interview-source-compiler.ts';

export type PublicFamilySeed = {
  id:string; name:string; signalId:string; intent:string; decisionPattern:string;
};
export type PublicQuestionSeed = {
  id:string; familyId:string; text:string; difficulty:'STANDARD'|'SENIOR'|'STAFF'; tags:string; pressure:string;
};
export type PublicLinkSeed = {
  id:string; familyId:string; evidenceRefId:string; boundaryId:string; routeId:string; strength:'STRONG'|'MEDIUM'|'WEAK'|'DEFENSIVE';
};
export type PublicMethodSeed = {
  key:string; sourceId:string; locator:string; kind:'RUBRIC'|'TECHNIQUE'|'NEGOTIATION'; text:string;
};
export type PublicAnchorSeed = {
  id:string; familyId:string; signalId:string; methodKey:string; polarity:'POSITIVE'|'NEGATIVE'; behavior:string;
};
export type PublicEdgeSeed = readonly [
  id:string, from:string, to:string, type:'FOLLOW_UP'|'CHALLENGE'|'CLARIFY'|'PREREQUISITE', priority:number
];

export function registerPublicCorpusWave(db:any,input:{
  wave:string;
  variantPrefix:string;
  families:PublicFamilySeed[];
  questions:PublicQuestionSeed[];
  links?:PublicLinkSeed[];
  methods:PublicMethodSeed[];
  anchors:PublicAnchorSeed[];
  edges?:PublicEdgeSeed[];
},now=new Date().toISOString()){
  registerAuditedInterviewSources(db,now);
  const methodUnits=new Map<string,string>();
  for(const method of input.methods){
    const source:any=db.prepare('SELECT canonical_url,name FROM interview_sources WHERE id=?').get(method.sourceId);
    if(!source) throw new Error(`${input.wave}_SOURCE_MISSING:${method.sourceId}`);
    const compiled:any=compileInterviewDocument(db,{
      sourceId:method.sourceId,
      title:`${input.wave}｜${source.name}`,
      canonicalUrl:source.canonical_url,
      capturedAt:now,
      units:[{locator:method.locator,kind:method.kind,text:method.text}],
    });
    const unit=compiled.units[0];
    if(!unit?.unitId) throw new Error(`${input.wave}_METHOD_UNIT_MISSING:${method.key}`);
    methodUnits.set(method.key,unit.unitId);
  }

  db.exec('BEGIN;');
  try{
    const family=db.prepare(`INSERT INTO interview_question_families(
      id,name,primary_signal_id,normalized_intent,decision_pattern,lifecycle,version,created_at,updated_at
    ) VALUES(?,?,?,?,?,'ACTIVE',1,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,primary_signal_id=excluded.primary_signal_id,
      normalized_intent=excluded.normalized_intent,decision_pattern=excluded.decision_pattern,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of input.families) family.run(row.id,row.name,row.signalId,row.intent,row.decisionPattern,now,now);

    const question=db.prepare(`INSERT INTO interview_questions(
      id,question_family_id,source_unit_id,canonical_text,language,difficulty,lifecycle,created_at,updated_at
    ) VALUES(?,?,NULL,?,'zh-CN',?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,source_unit_id=NULL,
      canonical_text=excluded.canonical_text,language=excluded.language,difficulty=excluded.difficulty,
      lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const variant=db.prepare(`INSERT INTO interview_question_variants(
      id,question_id,source_unit_id,text,tone,pressure_mode,language,lifecycle,created_at,updated_at
    ) VALUES(?,?,NULL,?,'DIRECT','PRESSURE','zh-CN','ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET question_id=excluded.question_id,text=excluded.text,
      tone=excluded.tone,pressure_mode=excluded.pressure_mode,lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    const search=db.prepare(`INSERT INTO interview_question_search(item_type,item_id,family_id,text,tags,signal_terms)
      VALUES('QUESTION',?,?,?,?,?)`);

    const evidenceByFamily=new Map<string,string>();
    for(const row of input.links??[]) if(!evidenceByFamily.has(row.familyId)) evidenceByFamily.set(row.familyId,row.evidenceRefId);

    for(const row of input.questions){
      question.run(row.id,row.familyId,row.text,row.difficulty,now,now);
      variant.run(`${input.variantPrefix}.${row.id.slice(4)}`,row.id,row.pressure,now,now);
      const signal:any=db.prepare(`SELECT s.id,s.name FROM interview_question_families f
        LEFT JOIN interview_signals s ON s.id=f.primary_signal_id WHERE f.id=?`).get(row.familyId);
      db.prepare("DELETE FROM interview_question_search WHERE item_type='QUESTION' AND item_id=?").run(row.id);
      const evidence=evidenceByFamily.get(row.familyId);
      const tags=`${row.tags}${evidence?` evidence:${evidence}`:''}`.trim();
      search.run(row.id,row.familyId,`${row.text} ${row.pressure}`,tags,`${signal?.id??''} ${signal?.name??''}`);
    }

    const link=db.prepare(`INSERT INTO interview_question_evidence_links(
      id,question_family_id,evidence_ref_id,claim_boundary_id,route_id,strength,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,evidence_ref_id=excluded.evidence_ref_id,
      claim_boundary_id=excluded.claim_boundary_id,route_id=excluded.route_id,strength=excluded.strength,
      lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of input.links??[]) link.run(
      row.id,row.familyId,row.evidenceRefId,row.boundaryId,row.routeId,row.strength,now,now
    );

    const anchor=db.prepare(`INSERT INTO interview_scoring_anchors(
      id,question_family_id,signal_id,source_unit_id,polarity,observable_behavior,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,'ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET question_family_id=excluded.question_family_id,signal_id=excluded.signal_id,
      source_unit_id=excluded.source_unit_id,polarity=excluded.polarity,observable_behavior=excluded.observable_behavior,
      lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const row of input.anchors){
      const unitId=methodUnits.get(row.methodKey);
      if(!unitId) throw new Error(`${input.wave}_METHOD_NOT_FOUND:${row.methodKey}`);
      anchor.run(row.id,row.familyId,row.signalId,unitId,row.polarity,row.behavior,now,now);
    }

    const edge=db.prepare(`INSERT INTO interview_question_edges(
      id,from_question_family_id,to_question_family_id,to_question_id,edge_type,priority,condition_json,lifecycle,created_at,updated_at
    ) VALUES(?,?,?,NULL,?,?,'{}','ACTIVE',?,?)
    ON CONFLICT(id) DO UPDATE SET from_question_family_id=excluded.from_question_family_id,
      to_question_family_id=excluded.to_question_family_id,to_question_id=NULL,
      edge_type=excluded.edge_type,priority=excluded.priority,condition_json=excluded.condition_json,
      lifecycle='ACTIVE',updated_at=excluded.updated_at`);
    for(const [id,from,to,type,priority] of input.edges??[]) edge.run(id,from,to,type,priority,now,now);

    db.exec('COMMIT;');
    return {
      families:input.families.length,
      questions:input.questions.length,
      variants:input.questions.length,
      evidenceLinks:(input.links??[]).length,
      scoringAnchors:input.anchors.length,
      edges:(input.edges??[]).length,
      methodUnits:methodUnits.size,
    };
  }catch(error){
    try{db.exec('ROLLBACK;')}catch{}
    throw error;
  }
}
