const path = require('path');
const { indexRepo } = require('./indexer');
const { Retriever } = require('./retriever');
const logger = require('./logger');

(async function(){
  const repo = process.argv[2] || process.cwd();
  const query = process.argv.slice(3).join(' ') || null;
  const outDir = path.join(repo,'.codegraph');
  
  // Check for --embed flag
  const embed = process.argv.includes('--embed');

  await indexRepo(repo,{embed,outDir});

  const retr = Retriever.load(outDir);

  let queries = [];
  if(query){
    queries = [query];
  }else{
    // auto-generate 3 queries from top SYMBOL names in graph
    const syms = [...retr.graph.nodes.values()].filter(n=>n.kind==='SYMBOL').slice(0,3);
    queries = syms.map(s=>s.name);
    if(queries.length===0) queries = ['main','init','test']; // fallback
  }

  for(const q of queries){
    console.log('\n=== QUERY:', q, '===');
    const res = await retr.retrieve(q,{k:10,expandHops:1});
    for(const n of res){
      const loc = n.loc ? `L${n.loc.startLine+1}-L${n.loc.endLine+1}` : '';
      console.log(`[${n.kind}] ${n.name} ${n.path?`(${n.path})`:''} ${loc}`);
      if(n.signature) console.log('  sig:', n.signature);
    }
  }
})();
