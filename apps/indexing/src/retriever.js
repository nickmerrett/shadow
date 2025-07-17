const fs = require('fs');
const path = require('path');
const cosine = require('cosine-similarity');

const { loadGraph, loadInverted, tokenize, normTok } = require('./storage');
const { CodeGraph } = require('./graph');
const { cheapHashEmbedding } = require('./embedder');

class Retriever {
  constructor(graph, inverted){
    this.graph = graph;
    this.inverted = inverted;
  }

  static load(outDir){
    const graph = loadGraph(outDir);
    const inverted = loadInverted(outDir);
    return new Retriever(graph,inverted);
  }

  // query may be NL or code
  retrieve(query, {k=20, expandHops=1}={}){
    const tokens = tokenize(query);
    const tokScores = new Map();
    for(const t of tokens){
      const l = this.inverted[t] || [];
      for(const id of l){
        tokScores.set(id, (tokScores.get(id)||0)+1);
      }
    }
    // lexical candidates
    const candLex = [...tokScores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k*5).map(([id,score])=>({id,lex:score}));

    // semantic candidates: embed query, compare to chunk embeddings
    const qVec = cheapHashEmbedding(query);
    const semScores=[];
    for(const node of this.graph.nodes.values()){
      if(node.kind!=='CHUNK') continue;
      if(!node.embedding) continue;
      const sim = cosine(Array.from(qVec), Array.from(node.embedding));
      semScores.push({id:node.id,sem:sim});
    }
    semScores.sort((a,b)=>b.sem-a.sem);
    const candSem = semScores.slice(0,k*5);

    // merge
    const merged = new Map();
    for(const c of candLex){
      const n = merged.get(c.id)||{id:c.id,lex:0,sem:0};
      n.lex = c.lex;
      merged.set(c.id,n);
    }
    for(const c of candSem){
      const n = merged.get(c.id)||{id:c.id,lex:0,sem:0};
      n.sem = c.sem;
      merged.set(c.id,n);
    }

    // score combined: weight lexical 1.0, semantic 2.0 normalized
    const scored=[];
    for(const m of merged.values()){
      const node = this.graph.get(m.id);
      if(!node) continue;
      const score = (m.lex||0) + 2*(m.sem||0);
      scored.push({node,score});
    }

    scored.sort((a,b)=>b.score-a.score);
    let results = scored.slice(0,k).map(x=>x.node);

    // optional expansion across graph edges
    if(expandHops>0){
      const seen = new Set(results.map(r=>r.id));
      for(let hop=0; hop<expandHops; hop++){
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

module.exports = { Retriever };
