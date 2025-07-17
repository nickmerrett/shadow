export interface Location {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    byteStart?: number;
    byteEnd?: number;
}

export interface GraphNode {
    id: string;
    kind: string;
    name: string;
    path: string;
    lang: string;
    loc: Location;
    signature: string;
    code: string;
    doc: string;
    meta: Record<string, any>;
    embedding: number[];
}

export interface GraphEdge {
    from: string;
    to: string;
    kind: string;
    meta: Record<string, any>;
}

export interface CodeGraphJSON {
    repoId: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface CodeGraph {
    repoId: string;
    nodes: Map<string, GraphNode>;
    adj: Map<string, GraphEdge[]>;
    rev: Map<string, GraphEdge[]>;
    addNode(node: GraphNode): GraphNode;
    addEdge(edge: GraphEdge): void;
    neighbors(id: string, filterKinds?: string[]): GraphNode[];
    incoming(id: string, filterKinds?: string[]): GraphNode[];
    get(id: string): GraphNode;
    graphToJSON(): CodeGraphJSON;
    JSONToGraph(obj: CodeGraphJSON): CodeGraph;
}

