import * as fs from 'fs';
import * as path from 'path';
import { Graph, GraphNode, GraphJSON } from '@/indexing/graph';

// Types
interface EmbeddingIndex {
  dim: number;
  idx: Record<string, { offset: number; length: number }>;
}

interface InvertedIndex {
  [token: string]: string[];
}

const GRAPH_FILE_NAME = 'graph.json'

// ---------------- Graph JSON ----------------
export const saveGraph = (graph: Graph, outDir: string): void => {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const obj: GraphJSON = graph.graphToJSON();
  
  // Strip inlined embeddings
  obj.nodes.forEach(node => {
    delete (node as any).embedding;
  });
  
  fs.writeFileSync(
    path.join(outDir, GRAPH_FILE_NAME), 
    JSON.stringify(obj, null, 2), 
    'utf8'
  );
};

export const loadGraph = (outDir: string): Graph => {
  const graphPath = path.join(outDir, GRAPH_FILE_NAME);
  
  if (!fs.existsSync(graphPath)) {
    throw new Error(`graph.json not found in ${outDir}`);
  }
  
  const obj: GraphJSON = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const graph = new Graph(obj.repoId);
  
  return graph.JSONToGraph(obj);
};

// ---------------- Embeddings (optional) ----------------
export const saveEmbeddings = (graph: Graph, outDir: string): void => {
  const chunks = Array.from(graph.nodes.values()).filter(
    (node): node is GraphNode & { embedding: Float32Array } => 
      node.kind === 'CHUNK' && Array.isArray(node.embedding) && node.embedding.length > 0
  );
  
  if (chunks.length === 0) return;

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const idx: Record<string, { offset: number; length: number }> = {};
  const allVecs: number[] = [];
  let offset = 0;

  chunks.forEach(chunk => {
    const vec = Array.from(chunk.embedding);
    idx[chunk.id] = { offset, length: vec.length };
    allVecs.push(...vec);
    offset += vec.length;
  });

  const dim = chunks[0].embedding.length;
  const f32 = new Float32Array(allVecs);
  const buf = Buffer.from(f32.buffer);

  const embeddingIndex: EmbeddingIndex = { dim, idx };

  fs.writeFileSync(
    path.join(outDir, 'embeddings.idx.json'),
    JSON.stringify(embeddingIndex),
    'utf8'
  );
  fs.writeFileSync(path.join(outDir, 'embeddings.f32'), buf);
};

export const loadEmbeddings = (graph: Graph, outDir: string): void => {
  const idxPath = path.join(outDir, 'embeddings.idx.json');
  const binPath = path.join(outDir, 'embeddings.f32');
  
  if (!fs.existsSync(idxPath) || !fs.existsSync(binPath)) return;
  
  const { dim, idx }: EmbeddingIndex = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  const buf = fs.readFileSync(binPath);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  
  Object.entries(idx).forEach(([id, { offset, length }]) => {
    const slice = f32.subarray(offset, offset + length);
    const node = graph.get(id);
    
    if (node) {
      node.embedding = new Float32Array(slice);
      if (node.meta) {
        (node.meta as any).embedding_dim = dim;
      } else {
        node.meta = { embedding_dim: dim };
      }
    }
  });
};

// ---------------- Inverted Lexical Index ----------------
export const buildInverted = (graph: Graph, outDir: string): void => {
  const idx: Record<string, Set<string>> = {};
  
  graph.nodes.forEach(node => {
    const textParts: string[] = [];
    if (node.code) textParts.push(node.code);
    if (node.signature) textParts.push(node.signature);
    if (node.name) textParts.push(node.name);
    
    const tokens = tokenize(textParts.join('\n'));
    
    tokens.forEach(token => {
      if (token.length > 0) {
        if (!idx[token]) {
          idx[token] = new Set();
        }
        idx[token].add(node.id);
      }
    });
  });
  
  const serial: InvertedIndex = {};
  Object.entries(idx).forEach(([key, value]) => {
    serial[key] = Array.from(value);
  });
  
  fs.writeFileSync(
    path.join(outDir, 'inverted.json'), 
    JSON.stringify(serial), 
    'utf8'
  );
};

export const loadInverted = (outDir: string): InvertedIndex => {
  const invertedPath = path.join(outDir, 'inverted.json');
  
  if (!fs.existsSync(invertedPath)) {
    return {};
  }
  
  return JSON.parse(fs.readFileSync(invertedPath, 'utf8'));
};