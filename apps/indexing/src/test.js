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

  await indexRepo(repo, { embed, outDir, force, paths });

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
    let hits = await retr.retrieve(q, { k: 10, expandHops: 1, returnMeta: true });
    hits = retr.withEdges(hits).filter(({ score }) => score >= 0.2);

    hits.forEach(({ node: n, score, edges }, idx) => {
      const loc = n.loc ? `L${n.loc.startLine + 1}-L${n.loc.endLine + 1}` : '';
      const scoreStr = score.toFixed(4);
      console.log(`\n${idx + 1}. [score=${scoreStr}] [${n.kind}] ${n.name} ${n.path ? `(${n.path})` : ''} ${loc}`);
      if (n.signature) console.log('   sig:', n.signature);

      if (edges.length) {
        console.log('   edges:');
        edges.forEach((e) => {
          if (e.dir === 'out') {
            console.log(`     - (${e.kind}) -> [${e.to.kind}] ${e.to.name}`);
            const snippet = e.to.snippet;
            if (snippet) {
              const indented = snippet
                .split('\n')
                .map((l) => '       | ' + l)
                .join('\n');
              console.log(indented);
            }
          } else {
            console.log(`     - (${e.kind}) <- [${e.from.kind}] ${e.from.name}`);
            const snippet = e.from.snippet;
            if (snippet) {
              const indented = snippet
                .split('\n')
                .map((l) => '       | ' + l)
                .join('\n');
              console.log(indented);
            }
          }
        });
      }
    });
  }
})();
