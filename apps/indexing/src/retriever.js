const cosine = require('cosine-similarity');
const { loadGraph, loadInverted, loadEmbeddings, tokenize, normTok } = require('./storage');
const { cheapHashEmbedding } = require('./embedder'); // fallback query embedding

class Retriever {
  constructor(graph, inverted){
    this.graph = graph;
    this.inverted = inverted;
  }

  static load(outDir){
    const graph = loadGraph(outDir);
    const inverted = loadInverted(outDir);
    // load embeddings into graph nodes (if present)
    loadEmbeddings(graph,outDir);
    return new Retriever(graph,inverted);
  }

  // embed query cheaply (could also run same Jina model; pluggable later)
  _embedQueryCheap(q){
    return cheapHashEmbedding(q,256);
  }

  retrieve(query,{k=20,expandHops=1}={}){
    // lexical
    const toks = tokenize(query);
    const tokScores = new Map();
    for(const t of toks){
      const hit = this.inverted[t] || [];
      for(const id of hit){
        tokScores.set(id,(tokScores.get(id)||0)+1);
      }
    }
    const candLex = [...tokScores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k*5).map(([id,score])=>({id,lex:score}));

    // semantic: compute query vector compat w/ stored dims if available
    // If first chunk has embedding_dim recorded, we could run cheap embedding of same dim? For now, we cosine against stored chunk dims directly if lengths differ we fallback.
    const qVecCheap = this._embedQueryCheap(query);
    const semScores=[];
    for(const node of this.graph.nodes.values()){
      if(node.kind!=='CHUNK' || !node.embedding) continue;
      const emb = node.embedding;
      let sim;
      if(emb.length === qVecCheap.length){
        sim = cosine(Array.from(qVecCheap), Array.from(emb));
      }else{
        // degrade gracefully: compute lexical proxy
        sim = 0;
      }
      semScores.push({id:node.id,sem:sim});
    }
    semScores.sort((a,b)=>b.sem-a.sem);
    const candSem = semScores.slice(0,k*5);

    // merge
    const merged = new Map();
    for(const c of candLex){
      merged.set(c.id,{id:c.id,lex:c.lex,sem:0});
    }
    for(const c of candSem){
      const m = merged.get(c.id)||{id:c.id,lex:0,sem:0};
      m.sem = c.sem;
      merged.set(c.id,m);
    }
    const scored=[];
    for(const m of merged.values()){
      const node = this.graph.get(m.id);
      if(!node) continue;
      const score = (m.lex||0) + 2*(m.sem||0);
      scored.push({node,score});
    }
    scored.sort((a,b)=>b.score-a.score);
    let results = scored.slice(0,k).map(x=>x.node);

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

module.exports = { Retriever };
