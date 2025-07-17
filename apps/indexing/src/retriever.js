/**
 * Retriever (lexical + structural; no semantic unless embeddings present)
 *
 * Usage:
 *   const { Retriever } = require('./src/retriever');
 *   const retr = Retriever.load('/path/to/repo/.codegraph');
 *   const results = retr.retrieve('foo bar', {k:20, expandHops:1});
 */
const { loadGraph, loadInverted, loadEmbeddings, tokenize } = require('./storage');
const { embedTexts } = require('./embedder');
function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

class Retriever {
  constructor(graph, inverted){
    this.graph = graph;
    this.inverted = inverted;
    this._hasEmbeddings = false;
  }

  static load(outDir){
    const graph = loadGraph(outDir);
    const inverted = loadInverted(outDir);
    loadEmbeddings(graph,outDir);  // if absent, no-op
    const r = new Retriever(graph,inverted);
    // detect whether any embeddings loaded
    r._hasEmbeddings = [...graph.nodes.values()].some(n=>n.kind==='CHUNK' && n.embedding);
    return r;
  }

  async retrieve(query,{k=20,expandHops=1,provider='local-transformers'}={}){
    if(this._hasEmbeddings){
      // Semantic search
      const chunks = [...this.graph.nodes.values()].filter(n=>n.kind==='CHUNK' && n.embedding);
      const {embeddings: [qvec]} = await embedTexts([query], {provider});
      const scored = chunks.map(n => ({node: n, score: cosineSim(qvec, n.embedding)}));
      scored.sort((a,b)=>b.score-a.score);
      let results = scored.slice(0,k).map(s=>s.node);
      // Expand graph neighborhood
      if(expandHops>0){
        const seen = new Set(results.map(r=>r.id));
        for(let hop=0;hop<expandHops;hop++){
          const layer=[];
          for(const n of results){
            const neigh = this.graph.neighbors(n.id,null);
            for(const nn of neigh){
              if(seen.has(nn.id)) continue;
              seen.add(nn.id); layer.push(nn);
            }
          }
          results = results.concat(layer);
        }
      }
      return results;
    } else {
      // lexical fallback
      const toks = tokenize(query);
      const tokScores = new Map();
      for(const t of toks){
        const hits = this.inverted[t] || [];
        for(const id of hits){
          tokScores.set(id,(tokScores.get(id)||0)+1);
        }
      }
      const candLex = [...tokScores.entries()].sort((a,b)=>b[1]-a[1]);
      const merged = new Map();
      for(const [id,score] of candLex){
        merged.set(id,{id,lex:score,sem:0});
      }
      const scored=[];
      for(const m of merged.values()){
        const node = this.graph.get(m.id);
        if(!node) continue;
        const score = m.lex; // lexical only
        scored.push({node,score});
      }
      scored.sort((a,b)=>b.score-a.score);
      let results = scored.slice(0,k).map(s=>s.node);
      // Expand graph neighborhood
      if(expandHops>0){
        const seen = new Set(results.map(r=>r.id));
        for(let hop=0;hop<expandHops;hop++){
          const layer=[];
          for(const n of results){
            const neigh = this.graph.neighbors(n.id,null);
            for(const nn of neigh){
              if(seen.has(nn.id)) continue;
              seen.add(nn.id); layer.push(nn);
            }
          }
          results = results.concat(layer);
        }
      }
      return results;
    }
  }
}

module.exports = { Retriever };
