// storage.js
const fs = require('fs');
const path = require('path');
const { CodeGraph } = require('./graph');
const { tokenize, normTok } = require('./tokenize-internal'); // we'll inline below if needed

// --------- Graph JSON ---------
function saveGraph(graph, outDir){
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const obj = graph.toJSON();
  // strip embeddings (stored separately) to keep graph.json smaller
  for(const n of obj.nodes){
    if(n.embedding){
      delete n.embedding;
    }
  }
  fs.writeFileSync(path.join(outDir,'graph.json'), JSON.stringify(obj,null,2),'utf8');
}

function loadGraph(outDir){
  const p = path.join(outDir,'graph.json');
  if(!fs.existsSync(p)) throw new Error(`graph.json not found in ${outDir}`);
  const obj = JSON.parse(fs.readFileSync(p,'utf8'));
  return CodeGraph.fromJSON(obj);
}

// --------- Embedding persistence ---------
// Writes Float32 embeddings into a contiguous binary file; builds index JSON mapping nodeId->offset,length
function saveEmbeddings(graph,outDir){
  const chunks = [...graph.nodes.values()].filter(n=>n.kind==='CHUNK' && n.embedding);
  if(!chunks.length) return;
  let dim = chunks[0].embedding.length;
  const idx = {};
  const buf = Buffer.allocUnsafe(chunks.length * dim * 4); // Float32
  for(let i=0;i<chunks.length;i++){
    const emb = chunks[i].embedding;
    if(emb.length !== dim) throw new Error(`inconsistent embedding dim for node ${chunks[i].id}`);
    // write floats
    for(let d=0;d<dim;d++){
      buf.writeFloatLE(emb[d], (i*dim + d)*4);
    }
    idx[chunks[i].id] = {offset:i*dim, length:dim};
  }
  fs.writeFileSync(path.join(outDir,'embeddings.f32'), buf);
  fs.writeFileSync(path.join(outDir,'embeddings.idx.json'), JSON.stringify({dim,idx},null,2),'utf8');
}

function loadEmbeddings(graph,outDir){
  const idxPath = path.join(outDir,'embeddings.idx.json');
  const binPath = path.join(outDir,'embeddings.f32');
  if(!fs.existsSync(idxPath) || !fs.existsSync(binPath)) return;
  const {dim,idx} = JSON.parse(fs.readFileSync(idxPath,'utf8'));
  const buf = fs.readFileSync(binPath);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength/4);
  for(const [id,{offset,length}] of Object.entries(idx)){
    const slice = f32.subarray(offset, offset+length);
    const node = graph.get(id);
    if(node){
      node.embedding = new Float32Array(slice); // copy
      if(node.meta) node.meta.embedding_dim = dim;
      else node.meta = {embedding_dim:dim};
    }
  }
}

// --------- Inverted text index ---------
function buildInverted(graph,outDir){
  const idx = {};
  for(const node of graph.nodes.values()){
    const textParts = [];
    if(node.code) textParts.push(node.code);
    if(node.signature) textParts.push(node.signature);
    if(node.name) textParts.push(node.name);
    const toks = tokenize(textParts.join('\n'));
    for(const t of toks){
      if(!idx[t]) idx[t] = new Set();
      idx[t].add(node.id);
    }
  }
  const serial = {};
  for(const [k,v] of Object.entries(idx)) serial[k] = [...v];
  fs.writeFileSync(path.join(outDir,'inverted.json'), JSON.stringify(serial),'utf8');
}

function loadInverted(outDir){
  const p = path.join(outDir,'inverted.json');
  if(!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p,'utf8'));
}

// --------- Simple tokenization (internal) ---------
function normTok(t){ return t.toLowerCase().replace(/[^a-z0-9_]+/g,''); }
function tokenize(text){ return text.split(/[^A-Za-z0-9_]+/).map(normTok).filter(Boolean); }

// re-export for other modules
module.exports = {
  saveGraph, loadGraph,
  saveEmbeddings, loadEmbeddings,
  buildInverted, loadInverted,
  tokenize, normTok,
};
