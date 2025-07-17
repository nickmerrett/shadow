const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const TreeSitter = require('tree-sitter');
const ignore = require('ignore');
const fg = require('fast-glob');

const logger = require('./logger');
const { getLanguageForPath } = require('./languages');
const { GraphNode, GraphEdge, CodeGraph, makeId } = require('./graph');
const { extractGeneric } = require('./extractors/generic');
const { chunkSymbol } = require('./chunker');
const { sliceByLoc } = require('./utils/text');
const { saveGraph, buildInverted, saveEmbeddings, loadGraph, loadEmbeddings } = require('./storage');
const { embedGraphChunks } = require('./embedder');

function computeRepoId(root){
  const h = crypto.createHash('sha1');
  h.update(path.resolve(root));
  return h.digest('hex').slice(0,12);
}

function loadIgnore(root){
  const ig = ignore();
  const gitIgnore = path.join(root,'.gitignore');
  if(fs.existsSync(gitIgnore)) ig.add(fs.readFileSync(gitIgnore,'utf8'));
  const codeiumIgnore = path.join(root,'.codeiumignore');
  if(fs.existsSync(codeiumIgnore)) ig.add(fs.readFileSync(codeiumIgnore,'utf8'));
  ig.add('node_modules');
  ig.add('.*');
  return ig;
}

async function indexRepo(
  root,
  {
    maxLines = 200,
    embed = false,
    outDir = path.join(root, '.shadow'),
    force = false,
    paths = null,        // optional array of glob patterns (relative to root)
  } = {}
) {
  // If graph already exists and re-indexing is not forced → just load & return
  const graphJsonPath = path.join(outDir, 'graph.json');
  if (!force && fs.existsSync(graphJsonPath)) {
    logger.info(`Existing index found at ${outDir}; loading (set force=true to re-index)`);
    const graph = loadGraph(outDir);
    // loadEmbeddings is a no-op if embedding files are absent
    loadEmbeddings(graph, outDir);
    return graph;
  }

  logger.info(`Indexing ${root}${paths ? ' (filtered)' : ''}${embed ? ' + embeddings' : ''}`);

  const repoId = computeRepoId(root);
  const graph = new CodeGraph(repoId);
  // Track symbols across all files for cross-file call resolution
  const globalSym = new Map(); // name -> [nodeId]
  const ig = loadIgnore(root);

  // Resolve file list (honours .gitignore & user-supplied patterns)
  const patterns = Array.isArray(paths) && paths.length ? paths : ['**/*.*'];
  const entries = await fg(patterns, { cwd: root, dot: true, onlyFiles: true, absolute: true });
  const relPaths = entries.map(p=>path.relative(root,p)).filter(p=>!ig.ignores(p));

  // REPO node
  const repoNode = new GraphNode({id:repoId,kind:'REPO',name:path.basename(root),path:'',lang:null});
  graph.addNode(repoNode);

  for(const rel of relPaths){
    const abs = path.join(root,rel);
    const spec = getLanguageForPath(abs);
    if(!spec){ logger.debug(`Skipping unsupported: ${rel}`); continue; }
    if(!spec.language){ logger.warn(`No grammar loaded for ${rel}`); continue; }

    const parser = new TreeSitter();
    parser.setLanguage(spec.language);
    const sourceText = fs.readFileSync(abs,'utf8');
    const tree = parser.parse(sourceText);
    const rootNode = tree.rootNode;

    // FILE node (record content hash + mtime for future incremental checks)
    const stat = fs.statSync(abs);
    const hash = crypto.createHash('sha1').update(sourceText).digest('hex');
    const fileId = makeId(repoId, rel, 'FILE', rel, null);
    const fileNode = new GraphNode({
      id: fileId,
      kind: 'FILE',
      name: rel,
      path: rel,
      lang: spec.id,
      meta: { hash, mtime: stat.mtimeMs },
    });
    graph.addNode(fileNode);
    graph.addEdge(new GraphEdge({from:repoId,to:fileId,kind:'CONTAINS'}));

    // Extract
    const {defs,imports,calls,docs} = extractGeneric(rootNode,spec,sourceText);
    const symNodes=[];

    // SYMBOL defs
    for(const d of defs){
      const sig = buildSignatureFromNode(d.node,spec,sourceText);
      const id = makeId(repoId,rel,'SYMBOL',d.name,d.loc);
      const symNode = new GraphNode({
        id,
        kind: 'SYMBOL',
        name: d.name,
        path: rel,
        lang: spec.id,
        loc: d.loc,
        signature: sig,
      }); // omit full code to avoid redundancy; chunks will hold code
      graph.addNode(symNode);
      graph.addEdge(new GraphEdge({from:fileId,to:symNode.id,kind:'CONTAINS'}));
      symNodes.push(symNode);
      // record in global symbol registry
      if (!globalSym.has(d.name)) globalSym.set(d.name, []);
      globalSym.get(d.name).push(symNode.id);
    }

    // COMMENT / DOC nodes
    for(const ds of docs){
      const docCode = sliceByLoc(sourceText,ds.loc).trim();
      if(!docCode) continue;
      const docId = makeId(repoId,rel,'DOC',`doc@${ds.loc.startLine}`,ds.loc);
      const docNode = new GraphNode({
        id:docId,kind:'COMMENT',name:`doc@${rel}:${ds.loc.startLine}`,path:rel,lang:spec.id,loc:ds.loc,code:docCode,doc:docCode
      });
      graph.addNode(docNode);
      graph.addEdge(new GraphEdge({from:fileId,to:docNode.id,kind:'CONTAINS'}));
      const near = symNodes.find(s=>s.loc.startLine >= ds.loc.endLine);
      if(near){
        graph.addEdge(new GraphEdge({from:docNode.id,to:near.id,kind:'DOCS_FOR'}));
      }
    }

    // IMPORT nodes
    for(const im of imports){
      const imText = sliceByLoc(sourceText,im.loc).trim();
      const name = imText.slice(0,64);
      const imId = makeId(repoId,rel,'IMPORT',name,im.loc);
      const imNode = new GraphNode({id:imId,kind:'IMPORT',name,path:rel,lang:spec.id,loc:im.loc,code:imText});
      graph.addNode(imNode);
      graph.addEdge(new GraphEdge({from:fileId,to:imNode.id,kind:'CONTAINS'}));
    }

    // CHUNK nodes per symbol
    for(const symNode of symNodes){
      const d = defs.find(x=>x.name===symNode.name && x.loc.startLine===symNode.loc.startLine);
      if(!d) continue;
      const chunks = chunkSymbol({
        repoId,fileNode:symNode,sym:d,lang:spec.id,sourceText,maxLines
      });
      let prev=null;
      for(const ch of chunks){
        graph.addNode(ch);
        graph.addEdge(new GraphEdge({from:symNode.id,to:ch.id,kind:'PART_OF'}));
        if(prev) graph.addEdge(new GraphEdge({from:prev.id,to:ch.id,kind:'NEXT_CHUNK'}));
        prev=ch;
      }
    }

    // CALL edges (intra-file first, then cross-file if symbol unique)
    const symMap = new Map(symNodes.map((s) => [s.name, s.id]));
    for (const c of calls) {
      const callText = sourceText.slice(c.loc.byteStart, c.loc.byteEnd);
      const m = callText.match(/([A-Za-z_][A-Za-z0-9_]*)/);
      if (!m) continue;
      const callee = m[1];

      // identify caller symbol enclosing the call site (if any)
      const callerSym = symNodes.find(
        (s) => s.loc.startLine <= c.loc.startLine && s.loc.endLine >= c.loc.endLine
      );

      let targetId = null;
      if (symMap.has(callee)) {
        targetId = symMap.get(callee);
      } else if (globalSym.has(callee) && globalSym.get(callee).length === 1) {
        targetId = globalSym.get(callee)[0]; // unique symbol across repo
      }

      if (callerSym && targetId) {
        graph.addEdge(
          new GraphEdge({
            from: callerSym.id,
            to: targetId,
            kind: 'CALLS',
            meta: { callSiteLine: c.loc.startLine },
          })
        );
      }
    }
  }

  // Embed chunks if requested
  if (embed) {
    logger.info('Computing embeddings...');
    const chunks = [...graph.nodes.values()].filter(n => n.kind === 'CHUNK');
    logger.info(`Found ${chunks.length} chunks to embed`);
    if(chunks.length > 0){
      await embedGraphChunks(chunks, {provider: 'local-transformers'});
      logger.info(`Embedded ${chunks.length} chunks`);
      // Debug: check if embeddings were actually added
      const withEmbeddings = chunks.filter(ch => ch.embedding);
      logger.info(`${withEmbeddings.length} chunks have embeddings`);
    }
  } else {
    logger.info('Embedding skipped (embed=false).');
  }

  // Persist
  if(embed) saveEmbeddings(graph,outDir); // save binary embeddings first
  saveGraph(graph,outDir); // then write graph (strips inlined embeddings)
  buildInverted(graph,outDir);
  logger.info(`Indexed ${graph.nodes.size} nodes. Output -> ${outDir}`);
  return graph;
}

function buildSignatureFromNode(node,spec,sourceText){
  const start = sourceText.slice(node.startIndex,node.endIndex).split('\n')[0].trim();
  return start.length>200 ? start.slice(0,200)+'…' : start;
}

module.exports = { indexRepo };
