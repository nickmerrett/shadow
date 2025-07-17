const path = require('path');
const { indexRepo } = require('./indexer');
const { Retriever } = require('./retriever');
const logger = require('./logger');

// Simple flag parsing (supports --embed, --force, --paths=a,b,c)
(async function(){
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter(a => a.startsWith('--')));
  const positional = argv.filter(a => !a.startsWith('--'));

  const repo = positional[0] || process.cwd();
  const query = positional.length > 1 ? positional.slice(1).join(' ') : null;
  const outDir = path.join(repo, '.shadow');

  const embed = flags.has('--embed');
  const force = flags.has('--force');

  let paths = null;
  for (const f of flags) {
    if (f.startsWith('--paths=')) {
      paths = f.slice('--paths='.length).split(',').map(p => p.trim()).filter(Boolean);
    }
  }
  // Index the repo, return graph in .shadow/graph.json
  await indexRepo(repo, { embed, outDir, force, paths });

  // Load the graph from .shadow/graph.json
  const retr = Retriever.load(outDir);

  let queries = [];
  if(query){
    queries = [query];
  } else {
    // auto-generate 3 queries from top SYMBOL names in graph
    const syms = [...retr.graph.nodes.values()].filter(n=>n.kind==='SYMBOL').slice(0,3);
    queries = syms.map(s=>s.name);
    if(queries.length===0) queries = ['main','init','test']; // fallback
  }

  for(const q of queries){
    console.log('\n=== QUERY:', q, '===');
    let hits = await retr.retrieve(q, { k: 10, expandHops: 1, returnMeta: true });
    hits = retr.withEdges(hits).filter(({ score }) => score >= 0.2);

    retr.displayHits(hits);

  }
})();
