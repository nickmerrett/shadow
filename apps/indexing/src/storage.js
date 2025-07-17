// JSON persistence + simple inverted index store
const fs = require('fs');
const path = require('path');
const { CodeGraph } = require('./graph');

function saveGraph(graph, outDir){
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
  fs.writeFileSync(path.join(outDir, 'graph.json'), JSON.stringify(graph.toJSON(), null, 2), 'utf8');
}

function loadGraph(outDir){
  const p = path.join(outDir, 'graph.json');
  if(!fs.existsSync(p)) throw new Error(`graph.json not found in ${outDir}`);
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  return CodeGraph.fromJSON(obj);
}

// Build and persist simple inverted index: token -> [nodeId]
function buildInverted(graph, outDir){
  const idx = {};
  for(const node of graph.nodes.values()){
    if(node.code){
      const toks = tokenize(node.code);
      for(const t of toks){
        if(!idx[t]) idx[t]=new Set();
        idx[t].add(node.id);
      }
    }
    if(node.signature){
      const toks = tokenize(node.signature);
      for(const t of toks){
        if(!idx[t]) idx[t]=new Set();
        idx[t].add(node.id);
      }
    }
    if(node.name){
      const t = normTok(node.name);
      if(!idx[t]) idx[t]=new Set();
      idx[t].add(node.id);
    }
  }
  const serial = {};
  for(const [k,v] of Object.entries(idx)) serial[k] = [...v];
  fs.writeFileSync(path.join(outDir,'inverted.json'), JSON.stringify(serial), 'utf8');
}

function loadInverted(outDir){
  const p = path.join(outDir,'inverted.json');
  if(!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Tokenization
function normTok(t){ return t.toLowerCase().replace(/[^a-z0-9_]+/g,''); }
function tokenize(text){
  return text.split(/[^A-Za-z0-9_]+/).map(normTok).filter(Boolean);
}

module.exports = { saveGraph, loadGraph, buildInverted, loadInverted, tokenize, normTok };
