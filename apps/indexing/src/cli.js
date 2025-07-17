#!/usr/bin/env node
const path = require('path');
const minimist = require('minimist');
const { indexRepo } = require('./indexer');
const { Retriever } = require('./retriever');
const logger = require('./logger');

async function main(){
  const argv = minimist(process.argv.slice(2));
  const cmd = argv._[0];
  if(!cmd || argv.h || argv.help){
    usage(); return;
  }

  if(cmd === 'index'){
    const root = argv._[1] || process.cwd();
    const outDir = argv.out || argv.o || path.join(root,'.codegraph');
    const maxLines = argv.maxLines ? Number(argv.maxLines) : 200;
    const embedProvider = argv['embed-provider'] || argv.ep || 'cheap-hash';
    const embedModel = argv['embed-model'] || argv.em || 'jinaai/jina-embeddings-v2-base-code';
    const embedBatch = argv['embed-batch'] ? Number(argv['embed-batch']) : 64;
    const embedQuantized = argv['embed-quantized'] !== undefined ? !!argv['embed-quantized'] : true;
    await indexRepo(root,{
      maxLines,
      embed:!argv['no-embed'],
      embedProvider,
      embedModel,
      embedBatch,
      embedQuantized,
      outDir,
    });

  }else if(cmd === 'query'){
    const outDir = argv.out || argv.o || path.join(process.cwd(),'.codegraph');
    const q = argv._.slice(1).join(' ') || argv.q;
    if(!q){ console.error('Missing query'); process.exit(1); }
    const retr = Retriever.load(outDir);
    const res = retr.retrieve(q,{k:argv.k?Number(argv.k):20,expandHops:argv.hops?Number(argv.hops):1});
    for(const n of res){
      console.log(`[${n.kind}] ${n.name} (${n.path||''})`);
      if(n.signature) console.log(`  sig: ${n.signature}`);
      if(n.loc) console.log(`  loc: L${n.loc.startLine+1}-L${n.loc.endLine+1}`);
    }
  }else{
    usage();
  }
}

function usage(){
  console.log(`
Usage:
  codegraph index [root] [--out DIR] [--maxLines N]
                  [--embed-provider cheap-hash|jina-api|local-transformers]
                  [--embed-model jinaai/jina-embeddings-v2-base-code]
                  [--embed-batch N] [--embed-quantized]
                  [--no-embed]
  codegraph query "search terms" [--out DIR] [--k N] [--hops H]

Examples:
  codegraph index ./myrepo --embed-provider jina-api
  codegraph index ./myrepo --embed-provider local-transformers --embed-quantized
  codegraph query "connect postgres database" --k 10
`);
}

if(require.main === module){
  main().catch(err=>{ logger.error(err); process.exit(1); });
}
