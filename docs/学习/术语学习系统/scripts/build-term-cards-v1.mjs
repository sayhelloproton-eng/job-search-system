import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(here,'../data');
const read=(name)=>JSON.parse(fs.readFileSync(path.join(data,name),'utf8'));
const terms=read('terms-v1.json');
const mapping=read('interview-topic-term-map-v1.json');
const graph=read('term-graph-v1.json');
const sources=read('term-card-sources-v1.json');
const seedFiles=['term-card-content-seeds-v1.jsonl',...fs.readdirSync(data).filter((name)=>/^term-card-content-seeds-t7-wave\d+\.jsonl$/.test(name)).sort(),...fs.readdirSync(data).filter((name)=>/^term-card-content-seeds-phase4-v\d+\.jsonl$/.test(name)).sort()];
const seedLines=seedFiles.flatMap((name)=>fs.readFileSync(path.join(data,name),'utf8').trim().split(/\n+/).map((line)=>({name,line})));
const seeds=seedLines.map(({name,line},i)=>{try{return JSON.parse(line)}catch(error){throw new Error(`${name} seed ${i+1}: ${error.message}`)}});

const termByName=new Map(terms.items.map((term)=>[term.canonicalName,term]));
const sourceIds=new Set(sources.sources.map((source)=>source.id));
const core=[]; const coreSeen=new Set();
for(const row of mapping.mappings){
  if(row.mode!=='TERM_GRAPH') continue;
  for(const ref of row.terms){ if(!coreSeen.has(ref.termId)){ coreSeen.add(ref.termId); core.push(ref); } }
}

const sourceGroups={
  agent:['src.internal.ai-modern-evolution','src.openai.agents'],
  mcp:['src.mcp.architecture'], observability:['src.otel.docs'], rag:['src.internal.ai-modern-evolution'],
  backend:['src.internal.ai-modern-evolution'], db:['src.postgres.mvcc'], system:['src.internal.ai-modern-evolution'],
  http:['src.mdn.http'], node:['src.node.docs'], js:['src.mdn.web'], testing:['src.internal.interview-corpus'],
  ts:['src.typescript.handbook'], fde:['src.internal.interview-corpus'], web:['src.mdn.web'], frontend:['src.mdn.web'],
  fullstack:['src.mdn.web'], react:['src.react.render'], oauth:['src.rfc.oauth2'],
  docker:['src.docker.docs'], k8s:['src.k8s.docs'], openapi:['src.openapi.spec'], security:['src.owasp.jwt'], reactrsc:['src.react.rsc'], next:['src.next.docs'],
};const specialSources={
  'Tool Calling':['src.openai.tools','src.internal.ai-modern-evolution'],
  'Tool Schema':['src.openai.tools','src.internal.ai-modern-evolution'],
  'Tool Contract':['src.openai.tools','src.internal.ai-modern-evolution'],
  'Handoff':['src.openai.handoffs','src.internal.ai-modern-evolution'],
  'Agent Trace':['src.openai.tracing','src.otel.docs'],
  'LangGraph':['src.langgraph.overview'],
  'Query Classification':['src.internal.ai-modern-evolution','src.openai.agents'],
  'SFT':['src.openai.sft','src.internal.ai-modern-evolution'],
  'Agentic RAG':['src.microsoft.agentic-retrieval','src.internal.ai-modern-evolution'],
  'MCP':['src.mcp.architecture'], 'Capability Discovery':['src.mcp.architecture'],
  'MCP Server':['src.mcp.architecture'], 'JSON-RPC':['src.mcp.architecture'],
  'Hydration':['src.react.hydration'], 'SSR':['src.react.server'], 'Hook':['src.react.hooks'],
  'React Server Components':['src.react.rsc'], 'Partial Prerendering':['src.next.docs'], 'Server Action':['src.next.docs'],
  'OpenAPI':['src.openapi.spec'], 'JWT':['src.owasp.jwt'], 'Container':['src.docker.docs'], 'Pod':['src.k8s.docs'], 'Kubernetes Deployment':['src.k8s.docs'],
  'OpenID Connect':['src.oidc.core','src.rfc.oauth2'], 'CSRF':['src.owasp.csrf'], 'XSS':['src.owasp.xss'],
  'LCP':['src.webvitals.lcp'], 'Partitioning':['src.postgres.partitioning'], 'Replication':['src.postgres.replication'],
  'ESM':['src.mdn.esm'], 'Optimistic UI':['src.react.optimistic'],
};

if(seeds.length<core.length) throw new Error(`seed count ${seeds.length} < core ${core.length}`);
const seedNames=new Set();
for(const seed of seeds){
  if(seedNames.has(seed.name)) throw new Error(`duplicate seed ${seed.name}`);
  seedNames.add(seed.name);
  if(!termByName.has(seed.name)) throw new Error(`seed not canonical ${seed.name}`);
  if(!sourceGroups[seed.sourceGroup]) throw new Error(`unknown sourceGroup ${seed.name}:${seed.sourceGroup}`);
  for(const field of ['plainDefinition','background','mechanism','boundaries','failureTradeoffs'])
    if(!String(seed[field]??'').trim()) throw new Error(`missing ${field}:${seed.name}`);
}
for(const ref of core) if(!seedNames.has(ref.canonicalName)) throw new Error(`missing core seed ${ref.canonicalName}`);

function interviewSummary(seed){
  const firstMechanism=String(seed.mechanism).split(/[。；]/)[0].trim();
  const full=`${seed.name}：${seed.plainDefinition} 核心机制是${firstMechanism}。`;
  if(full.length<=160) return full;
  const budget=Math.max(24,150-(`${seed.name}：${seed.plainDefinition} 核心机制是`).length);
  return `${seed.name}：${seed.plainDefinition} 核心机制是${firstMechanism.slice(0,budget)}…`;
}
const cards=seeds.map((seed)=>{
  const term=termByName.get(seed.name);
  const sourceRefs=specialSources[seed.name]??sourceGroups[seed.sourceGroup];
  for(const id of sourceRefs) if(!sourceIds.has(id)) throw new Error(`bad source ${seed.name}:${id}`);
  return {termId:term.id,canonicalName:term.canonicalName,contentStatus:'COMPACT_CURATED_V1',plainDefinition:seed.plainDefinition,
    background:seed.background,purpose:seed.plainDefinition,mechanism:seed.mechanism,
    systemPosition:{chains:term.chains??[],priority:term.strongestSourceBand,termClass:term.termClass},
    boundaries:[seed.boundaries],failureTradeoffs:[seed.failureTradeoffs],
    interview30s:interviewSummary(seed),
    sourceRefs,reviewedAt:'2026-09-08'};
});
const hubIds=new Set(); for(const edge of graph.edges){ hubIds.add(edge.from); hubIds.add(edge.to); }
const coreIds=new Set(core.map((ref)=>ref.termId));
const output={schemaVersion:'term-cards.v1',generatedAt:'2026-09-08',coverageScope:'INTERVIEW_CORE_PLUS_HUB_EXPANSION',
  interviewCoreTarget:coreIds.size,interviewCoreMaterialized:cards.filter((card)=>coreIds.has(card.termId)).length,
  hubTargetTerms:hubIds.size,materializedHubTerms:cards.filter((card)=>hubIds.has(card.termId)).length,
  canonicalTargetTerms:terms.items.length,materializedTerms:cards.length,items:cards};
fs.writeFileSync(path.join(data,'term-cards-v1.json'),JSON.stringify(output,null,2)+'\n');
const lengths=cards.map((card)=>card.interview30s.length);
console.log(JSON.stringify({seedCount:seeds.length,coreCount:core.length,cards:cards.length,uniqueTermIds:new Set(cards.map((card)=>card.termId)).size,
  interviewCoreMaterialized:output.interviewCoreMaterialized,hubTargetTerms:output.hubTargetTerms,materializedHubTerms:output.materializedHubTerms,
  interview30s:{min:Math.min(...lengths),max:Math.max(...lengths),avg:Math.round(lengths.reduce((sum,n)=>sum+n,0)/lengths.length)}},null,2));
