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
const { embedChunks } = require('./embedder');
const { sliceByLoc } = require('./utils/text');

// Compute repoId as SHA1 of root absolute path + mtime digest of all files
function computeRepoId(root){
  const h = crypto.createHash('sha1');
  h.update(path.resolve(root));
  return h.digest('hex').slice(0,12);
}

function loadIgnore(root){
  const ig = ignore();
  const gitIgnore = path.join(root, '.gitignore');
  if(fs.existsSync(gitIgnore)) ig.add(fs.readFileSync(gitIgnore,'utf8'));
  const codeiumIgnore = path.join(root, '.codeiumignore');
  if(fs.existsSync(codeiumIgnore)) ig.add(fs.readFileSync(codeiumIgnore,'utf8'));
  // default ignores: node_modules, dotfiles
  ig.add('node_modules');
  ig.add('.*');
  return ig;
}

async function indexRepo(root, {maxLines=200, embed=true, outDir=path.join(root,'.codegraph')}={}){
  logger.info(`Indexing ${root}`);
  const repoId = computeRepoId(root);
  const graph = new CodeGraph(repoId);
  const ig = loadIgnore(root);

  const entries = await fg(['**/*.*'], {cwd:root, dot:true, onlyFiles:true, absolute:true});
  const relPaths = entries.map(p=>path.relative(root,p)).filter(p=>!ig.ignores(p));

  // Add REPO root node
  const repoNode = new GraphNode({id:repoId, kind:'REPO', name:path.basename(root), path:'', lang:null});
  graph.addNode(repoNode);

  for(const rel of relPaths){
    const abs = path.join(root, rel);
    const spec = getLanguageForPath(abs);
    if(!spec){ logger.debug(`Skipping unsupported: ${rel}`); continue; }
    if(!spec.language){ logger.warn(`No grammar loaded for ${rel}`); continue; }

    const langMod = spec.language;
    const parser = new TreeSitter();
    parser.setLanguage(langMod);

    const sourceText = fs.readFileSync(abs,'utf8');
    const tree = parser.parse(sourceText);
    const rootNode = tree.rootNode;

    // FILE node
    const fileId = makeId(repoId, rel, 'FILE', rel, null);
    const fileNode = new GraphNode({id:fileId, kind:'FILE', name:rel, path:rel, lang:spec.id});
    graph.addNode(fileNode);
    graph.addEdge(new GraphEdge({from:repoId,to:fileId,kind:'CONTAINS'}));

    // Extract symbols/imports/calls/docs
    const {defs, imports, calls, docs} = extractGeneric(rootNode, spec, sourceText);

    // Symbol nodes
    const symNodes = [];
    for(const d of defs){
      const sig = buildSignatureFromNode(d.node, spec, sourceText);
      const id = makeId(repoId, rel, 'SYMBOL', d.name, d.loc);
      const code = sliceByLoc(sourceText, d.loc);
      const symNode = new GraphNode({
        id, kind:'SYMBOL', name:d.name, path:rel, lang:spec.id, loc:d.loc, signature:sig, code
      });
      graph.addNode(symNode);
      symNodes.push(symNode);
      graph.addEdge(new GraphEdge({from:fileId,to:symNode.id,kind:'CONTAINS'}));
    }

    // Doc nodes (very light heuristic: inline comment or string literal at root of symbol)
    for(const ds of docs){
      const docCode = sliceByLoc(sourceText, ds.loc).trim();
      if(!docCode) continue;
      const docId = makeId(repoId, rel, 'DOC', `doc@${ds.loc.startLine}`, ds.loc);
      const docNode = new GraphNode({
        id:docId, kind:'COMMENT', name:`doc@${rel}:${ds.loc.startLine}`, path:rel, lang:spec.id, loc:ds.loc, code:docCode, doc:docCode
      });
      graph.addNode(docNode);
      graph.addEdge(new GraphEdge({from:fileId,to:docId,kind:'CONTAINS'}));
      // attempt to associate doc with nearest symbol starting after doc line
      const near = symNodes.find(s=>s.loc.startLine >= ds.loc.endLine);
      if(near){
        graph.addEdge(new GraphEdge({from:docId,to:near.id,kind:'DOCS_FOR'}));
      }
    }

    // Import nodes
    for(const im of imports){
      const imText = sliceByLoc(sourceText, im.loc).trim();
      const name = imText.slice(0,64);
      const imId = makeId(repoId, rel, 'IMPORT', name, im.loc);
      const imNode = new GraphNode({id:imId, kind:'IMPORT', name, path:rel, lang:spec.id, loc:im.loc, code:imText});
      graph.addNode(imNode);
      graph.addEdge(new GraphEdge({from:fileId,to:imId,kind:'CONTAINS'}));
    }

    // Chunk symbols
    for(const symNode of symNodes){
      const d = defs.find(x=>x.name===symNode.name && x.loc.startLine===symNode.loc.startLine);
      if(!d) continue;
      const chunks = chunkSymbol({
        repoId, fileNode:symNode, sym:d, lang:spec.id, sourceText, maxLines
      });
      // Add chunk nodes + edges
      let prev=null;
      for(const ch of chunks){
        graph.addNode(ch);
        graph.addEdge(new GraphEdge({from:symNode.id,to:ch.id,kind:'PART_OF'}));
        if(prev) graph.addEdge(new GraphEdge({from:prev.id,to:ch.id,kind:'NEXT_CHUNK'}));
        prev=ch;
      }
    }

    // CALL edges heuristic: map by identifier text to symbol in same file (basic)
    const symMap = new Map(symNodes.map(s=>[s.name,s.id]));
    for(const c of calls){
      const callText = sourceText.slice(c.loc.byteStart, c.loc.byteEnd);
      // naive: regex first identifier
      const m = callText.match(/([A-Za-z_][A-Za-z0-9_]*)/);
      if(!m) continue;
      const calleeName = m[1];
      if(symMap.has(calleeName)){
        // create ephemeral call node? Instead attach from file to symbol; for more detail, chunk->symbol
        graph.addEdge(new GraphEdge({from:fileId,to:symMap.get(calleeName),kind:'CALLS',meta:{callSiteLine:c.loc.startLine}}));
      }
    }
  }

  // Embeddings (optional; only for CHUNK nodes)
  if(embed){
    const chunks = [...graph.nodes.values()].filter(n=>n.kind==='CHUNK');
    await embedChunks(chunks,{});
  }

  // Persist
  const { saveGraph, buildInverted } = require('./storage');
  saveGraph(graph,outDir);
  buildInverted(graph,outDir);
  logger.info(`Indexed ${graph.nodes.size} nodes. Output -> ${outDir}`);

  return graph;
}

// Build a simple signature string from a node
function buildSignatureFromNode(node, spec, sourceText){
  // try to slice single line of code where node starts
  const start = sourceText.slice(node.startIndex, node.endIndex).split('\n')[0].trim();
  return start.length>200 ? start.slice(0,200)+'…' : start;
}

module.exports = { indexRepo };
