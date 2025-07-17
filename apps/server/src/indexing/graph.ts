const crypto = require("crypto");
import type { GraphNode as IGraphNode, GraphEdge as IGraphEdge, CodeGraph as ICodeGraph, Location, CodeGraphJSON, CodeGraph } from "./types/graphTypes";
import { HashGenerator } from "./utils/hash";

export class GraphNode implements IGraphNode, HashGenerator {
  public id: string;
  public kind: string;
  public name: string;
  public path: string;  
  public lang: string;
  public loc: Location;
  public signature: string;
  public code: string;
  public doc: string;
  public meta: Record<string, any>;
  public embedding: number[];

  constructor({
    id,
    kind,
    name,
    path = '',  
    lang = '',
    loc = { startLine: 0, startCol: 0, endLine: 0, endCol: 0, byteStart: 0, byteEnd: 0 },
    signature = '',
    code = '',
    doc = '',
    meta = {},
  }: Partial<GraphNode>) {
    this.id = id!;
    this.kind = kind!;
    this.name = name!;
    this.path = path;
    this.lang = lang;
    this.loc = loc;
    this.signature = signature;
    this.code = code;
    this.doc = doc;
    this.meta = meta;
    this.embedding = [];
  }

  generateHash(): string {
    const h = crypto.createHash("sha1");
    h.update(
      this.id +
        "|" +
        this.path +
        "|" +
        this.kind +
        "|" +
        this.name +
        "|" +
        `${this.loc.startLine}:${this.loc.startCol}-${this.loc.endLine}:${this.loc.endCol}`
    );
    return h.digest("hex");
  }
}



export class GraphEdge implements IGraphEdge {
  public from: string;
  public to: string;
  public kind: string;
  public meta: Record<string, any>;

  constructor({ from, to, kind, meta = {} }: GraphEdge) {
    this.from = from;
    this.to = to;
    this.kind = kind;
    this.meta = meta;
  }
}

export class Graph implements ICodeGraph {
  public repoId: string;
  public nodes: Map<string, GraphNode>;
  public adj: Map<string, GraphEdge[]>;
  public rev: Map<string, GraphEdge[]>;

  constructor(repoId: string) {
    this.repoId = repoId;
    this.nodes = new Map();
    this.adj = new Map();
    this.rev = new Map();
  }

  addNode(node: GraphNode): GraphNode {
    if (this.nodes.has(node.id)) return this.nodes.get(node.id)!;
    this.nodes.set(node.id, node);
    this.adj.set(node.id, []);
    this.rev.set(node.id, []);
    return node;
  }

  addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) return;
    this.adj.get(edge.from)!.push(edge);
    this.rev.get(edge.to)!.push(edge);
  }

  neighbors(id: string, filterKinds?: string[]): GraphNode[] {
    const edges = this.adj.get(id) || [];
    return edges
      .filter((e) => !filterKinds || filterKinds.includes(e.kind))
      .map((e) => this.nodes.get(e.to)!)
      .filter(Boolean);
  }

  incoming(id: string, filterKinds?: string[]): GraphNode[] {
    const edges = this.rev.get(id) || [];
    return edges
      .filter((e) => !filterKinds || filterKinds.includes(e.kind))
      .map((e) => this.nodes.get(e.from)!)
      .filter(Boolean);
  }

  get(id: string): GraphNode {
    return this.nodes.get(id)!;
  }

  graphToJSON(): CodeGraphJSON {
    return {
      repoId: this.repoId,
      nodes: [...this.nodes.values()],
      edges: Array.from(this.adj.values()).flat(),
    };
  }

  JSONToGraph(obj: CodeGraphJSON): CodeGraph {
    const g = new Graph(obj.repoId);
    for (const n of obj.nodes) g.addNode(new GraphNode(n));
    for (const e of obj.edges) g.addEdge(new GraphEdge(e));
    return g;
  }
}

// DEPRECATED: use GraphNode.generateHash() instead
function makeId(repoId: string, path: string, kind: string, name: string, loc: { startLine: number; startCol: number; endLine: number; endCol: number } | null) {
  const h = crypto.createHash("sha1");
  h.update(
    repoId +"|" + path + "|" + kind + "|" + name + "|" +
      (loc ? `${loc.startLine}:${loc.startCol}-${loc.endLine}:${loc.endCol}` : "")
  );
  return h.digest("hex");
}

// For backward compatibility
module.exports = { GraphNode, GraphEdge, Graph, makeId };
