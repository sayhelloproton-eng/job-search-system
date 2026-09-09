import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { seedDatabase } from '../server/seed.ts';

test('public seed references only examples for resume/career data',()=>{
  const db=openDatabase(':memory:');
  try{
    seedDatabase(db);
    const rows:any[]=db.prepare('SELECT source_path FROM resumes ORDER BY id').all() as any[];
    assert.equal(rows.length,2);
    for(const row of rows)assert.match(row.source_path,/^examples\/candidate\//);
  }finally{db.close();}
});
