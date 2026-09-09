import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/server.ts';

test('demo app is isolated from local job and career-data environment',async()=>{
  const previousDb=process.env.JOB_SEARCH_DB_PATH;
  const previousCareer=process.env.CAREER_FACTS_PATH;
  process.env.JOB_SEARCH_DB_PATH='/private/demo-must-not-use.db';
  process.env.CAREER_FACTS_PATH='/private/demo-must-not-use.md';

  const app=createApp({demo:true});
  await new Promise<void>((resolve)=>app.server.listen(0,'127.0.0.1',resolve));
  try{
    const address:any=app.server.address();
    const base=`http://127.0.0.1:${address.port}`;

    const jobs=await fetch(`${base}/api/jobs?scope=all`).then((response)=>response.json());
    assert.equal(jobs.items.length,6);
    assert.ok(jobs.items.every((job:any)=>String(job.source_url).startsWith('https://example.local/')));
    assert.deepEqual(
      jobs.items.map((job:any)=>job.company).sort(),
      ['云帆网络','旧城软件','星云科技','未来实验室','矩阵智能','青空云'].sort(),
    );

    const info=await fetch(`${base}/api/personal-info`).then((response)=>response.json());
    assert.equal(info.sources.length,1);
    assert.equal(info.sources[0].available,true);
    assert.match(info.sources[0].path,/examples\/candidate\/career-facts\.md$/);
    assert.match(info.sources[0].content,/Synthetic fixture|Demo Candidate/);
    assert.doesNotMatch(info.sources[0].path,/demo-must-not-use/);
  }finally{
    await app.close();
    if(previousDb===undefined)delete process.env.JOB_SEARCH_DB_PATH;
    else process.env.JOB_SEARCH_DB_PATH=previousDb;
    if(previousCareer===undefined)delete process.env.CAREER_FACTS_PATH;
    else process.env.CAREER_FACTS_PATH=previousCareer;
  }
});
