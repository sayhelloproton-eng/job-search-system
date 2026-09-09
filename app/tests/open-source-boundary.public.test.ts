import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '../server/db.ts';
import { registerCandidateInterviewEvidence } from '../server/interview-candidate-evidence.ts';

const ROOT=resolve(import.meta.dirname,'../..');

test('public candidate evidence uses synthetic demo fixtures only',()=>{
  const db=openDatabase(':memory:');
  try{
    const result=registerCandidateInterviewEvidence(db,'2026-09-10T00:00:00.000Z');
    assert.equal(result.source,'SYNTHETIC_DEMO');
    const rows:any[]=db.prepare('SELECT id,canonical_path FROM interview_evidence_refs ORDER BY id').all() as any[];
    assert.equal(rows.length,12);
    for(const row of rows){
      assert.match(row.id,/^ev\.demo\./);
      assert.match(row.canonical_path,/^examples\/candidate\/evidence\//);
      assert.equal(existsSync(resolve(ROOT,row.canonical_path)),true,row.canonical_path);
    }
  }finally{db.close();}
});

test('public evidence keeps a conservative partial full-stack fixture',()=>{
  const db=openDatabase(':memory:');
  try{
    registerCandidateInterviewEvidence(db);
    const row:any=db.prepare("SELECT source_kind,evidence_status FROM interview_evidence_refs WHERE id='ev.demo.fullstack-runtime'").get();
    assert.equal(row.source_kind,'CAREER_FACT');
    assert.equal(row.evidence_status,'PARTIAL');
  }finally{db.close();}
});
