const path = require('path');
const { indexRepo } = require('./indexer');
const { Retriever } = require('./retriever');
const Writer = require('./writer');
const logger = require('./logger');

// Function to search the indexed repo
async function searchRepo(repo, query, options = {}) {
  const outDir = path.join(repo, '.shadow');
  
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
}

// Simple flag parsing (supports --embed, --force, --paths=a,b,c, --write=file:content)
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

  // Handle --write flag for file writing
  let filesToWrite = null;
  for (const f of flags) {
    if (f.startsWith('--write=')) {
      const writeData = f.slice('--write='.length);
      try {
        filesToWrite = JSON.parse(writeData);
      } catch (e) {
        console.error('Invalid --write format. Use: --write=\'{"file.js":"content"}\'');
        process.exit(1);
      }
    }
  }
  console.log('BEFORE ADDING FILES')
  // Index the repo, return graph in .shadow/graph.json
  await indexRepo(repo, { embed, outDir, force, paths });

  if (query) {
    await searchRepo(repo, query);
  } else {
    console.log('Indexing complete. No query provided, skipping search.');
  }
  // Write files if --write flag is provided
  if (filesToWrite) {
    const writer = new Writer(repo);
    writer.initRepo();
    
    try {
      const changes = await writer.writeFiles(filesToWrite);
      console.log(`Wrote ${Object.keys(filesToWrite).length} files`);
      console.log('Changes:', changes.map(c => `${c.action}: ${c.path}`).join(', '));
    } catch (error) {
      console.error(`Failed to write files: ${error.message}`);
      process.exit(1);
    }
  }
  console.log('AFTER ADDING FILES')
  // Index the repo, return graph in .shadow/graph.json
  await indexRepo(repo, { embed, outDir, force, paths });

  if (query) {
    await searchRepo(repo, query);
  } else {
    console.log('Indexing complete. No query provided, skipping search.');
  }
})();

module.exports = { searchRepo };
