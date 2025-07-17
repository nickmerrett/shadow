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

  /**
   * Retrieve relevant graph nodes for a query.
   *
   * Options
   * -------
   * k            : Max primary hits to return before hop-expansion.
   * expandHops   : How many neighborhood hops to append.
   * provider     : Embedding provider when semantic search is available.
   * returnMeta   : When true, returns objects {node, score, edges} instead of bare nodes.
   */
  async retrieve(
    query,
    { k = 20, expandHops = 1, provider = 'local-transformers', returnMeta = false } = {}
  ) {
    if (this._hasEmbeddings) {
      // Semantic search
      const chunks = [...this.graph.nodes.values()].filter(n=>n.kind==='CHUNK' && n.embedding);
      const {embeddings: [qvec]} = await embedTexts([query], {provider});
      const scored = chunks.map(n => ({node: n, score: cosineSim(qvec, n.embedding)}));
      scored.sort((a,b)=>b.score-a.score);
      let results = scored.slice(0, k);
      // Expand graph neighborhood
      if (expandHops > 0) {
        const seen = new Set(results.map(r => r.node.id));
        for (let hop = 0; hop < expandHops; hop++) {
          const layer=[];
          for (const { node: n } of results) {
            const neigh = this.graph.neighbors(n.id, null);
            for(const nn of neigh){
              if (seen.has(nn.id)) continue;
              seen.add(nn.id); layer.push({ node: nn, score: 0 });
            }
          }
          results = results.concat(layer);
        }
      }
      return returnMeta ? results : results.map((r) => r.node);
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
      let results = scored.slice(0, k);
      // Expand graph neighborhood
      if (expandHops > 0) {
        const seen = new Set(results.map(r => r.node.id));
        for (let hop = 0; hop < expandHops; hop++) {
          const layer=[];
          for (const { node: n } of results) {
            const neigh = this.graph.neighbors(n.id, null);
            for(const nn of neigh){
              if (seen.has(nn.id)) continue;
              seen.add(nn.id); layer.push({ node: nn, score: 0 });
            }
          }
          results = results.concat(layer);
        }
      }
      return returnMeta ? results : results.map((r) => r.node);
    }
  }

  /**
   * Convert a list returned with returnMeta=true into richer objects that also
   * include direct outgoing edges for easier inspection.
   */
  withEdges(items) {
    return items.map(({ node, score }) => {
      const outEdges = (this.graph.adj.get(node.id) || []).map((e) => {
        const target = this.graph.get(e.to);
        const snippet = target?.code
          ? target.code.split('\n').slice(0, 5).join('\n').trim()
          : target?.signature || '';
        return {
          kind: e.kind,
          dir: 'out',
          to: target
            ? {
                id: target.id,
                name: target.name,
                kind: target.kind,
                snippet,
              }
            : { id: e.to },
        };
      });

      const inEdges = (this.graph.rev.get(node.id) || []).map((e) => {
        const source = this.graph.get(e.from);
        const snippet = source?.code
          ? source.code.split('\n').slice(0, 5).join('\n').trim()
          : source?.signature || '';
        return {
          kind: e.kind,
          dir: 'in',
          from: source
            ? {
                id: source.id,
                name: source.name,
                kind: source.kind,
                snippet,
              }
            : { id: e.from },
        };
      });

      const edges = outEdges.concat(inEdges);
      return { node, score, edges };
    });
  }
  displayHits(hits) {
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
}

module.exports = { Retriever };
