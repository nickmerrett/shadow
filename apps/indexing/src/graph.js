const crypto = require("crypto");

class GraphNode {
  constructor({
    id,
    kind,
    name,
    path = null,
    lang = null,
    loc = null,
    signature = null,
    code = null,
    doc = null,
    meta = null,
  }) {
    this.id = id;
    this.kind = kind;
    this.name = name;
    this.path = path;
    this.lang = lang;
    this.loc = loc;
    this.signature = signature;
    this.code = code;
    this.doc = doc;
    this.meta = meta || {};
    this.embedding = null;
  }
}

class GraphEdge {
  constructor({ from, to, kind, meta = null }) {
    this.from = from;
    this.to = to;
    this.kind = kind;
    this.meta = meta || {};
  }
}

class CodeGraph {
  constructor(repoId) {
    this.repoId = repoId;
    this.nodes = new Map();
    this.adj = new Map();
    this.rev = new Map();
  }

  addNode(node) {
    if (this.nodes.has(node.id)) return this.nodes.get(node.id);
    this.nodes.set(node.id, node);
    this.adj.set(node.id, []);
    this.rev.set(node.id, []);
    return node;
  }

  addEdge(edge) {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) return;
    this.adj.get(edge.from).push(edge);
    this.rev.get(edge.to).push(edge);
  }

  neighbors(id, filterKinds = null) {
    const edges = this.adj.get(id) || [];
    return edges
      .filter((e) => !filterKinds || filterKinds.includes(e.kind))
      .map((e) => this.nodes.get(e.to));
  }

  incoming(id, filterKinds = null) {
    const edges = this.rev.get(id) || [];
    return edges
      .filter((e) => !filterKinds || filterKinds.includes(e.kind))
      .map((e) => this.nodes.get(e.from));
  }

  get(id) {
    return this.nodes.get(id);
  }

  toJSON() {
    return {
      repoId: this.repoId,
      nodes: [...this.nodes.values()],
      edges: [].concat(...[...this.adj.values()].map((arr) => arr)),
    };
  }

  static fromJSON(obj) {
    const g = new CodeGraph(obj.repoId);
    for (const n of obj.nodes) g.addNode(new GraphNode(n));
    for (const e of obj.edges) g.addEdge(new GraphEdge(e));
    return g;
  }
}

function makeId(repoId, path, kind, name, loc) {
    const h = crypto.createHash("sha1");
    h.update(
      repoId +
        "|" +
        path +
        "|" +
        kind +
        "|" +
        name +
        "|" +
        (loc
          ? `${loc.startLine}:${loc.startCol}-${loc.endLine}:${loc.endCol}`
          : "")
    );
    return h.digest("hex");
  }
  
  module.exports = { GraphNode, GraphEdge, CodeGraph, makeId };
