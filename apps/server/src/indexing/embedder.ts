/**
 * Embedding providers for CodeGraph.
 *
 * Providers:
 *   - 'jina-api'           -> Remote Jina Embedding API (recommended for quick start)
 *   - 'local-transformers' -> @xenova/transformers ONNX inference (offline)
 *   - 'cheap-hash'         -> deterministic fallback (no ML)
 *
 * Default provider = 'cheap-hash' (backward compat) unless overridden by indexer options.
 *
 * Jina v2 Base Code model details:
 *   * 161M param JinaBERT variant w/ ALiBi extrapolation to 8K tokens.
 *   * Trained on GitHub code + ~150M code QA/docstring pairs across ~30 PLs.
 *   * Use MEAN pooling over token embeddings; L2-normalize for cosine sim.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { logger } from './logger';


type EmbeddingProvider = 'jina-api' | 'local-transformers' | 'cheap-hash';

interface EmbedViaJinaAPIOptions {
  model?: string;
  normalized?: boolean;
  embedding_type?: 'float' | 'binary' | 'base64';
  batchSize?: number;
  apiKey?: string;
  endpoint?: string;
  signal?: AbortSignal;
}

interface EmbedViaLocalTransformersOptions {
  model?: string;
  quantized?: boolean;
  batchSize?: number;
}

interface EmbedTextsOptions extends EmbedViaJinaAPIOptions, EmbedViaLocalTransformersOptions {
  provider?: EmbeddingProvider;
}

interface EmbeddingResult {
  embeddings: Float32Array[];
  dim: number;
}

export type ChunkNode = {
    code?: string;
    embedding?: Float32Array;
    meta?: { [k: string]: any };
  };

// ------------------------------
// Cheap hash fallback
// ------------------------------
function cheapHashEmbedding(text: string, dim: number = 256): Float32Array {
  const buf = Buffer.from(text);
  const vec = new Float32Array(dim);
  for (let i = 0; i < buf.length; i++) {
    const index = buf[i]! % dim;
    vec[index] = (vec[index] || 0) + 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += (vec[i] || 0) * (vec[i] || 0);
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] = (vec[i] || 0) / norm;
  return vec;
}

// ------------------------------
// Remote Jina API provider
// ------------------------------
async function embedViaJinaAPI(
  texts: string[],
  {
    model = 'jina-embeddings-v2-base-code',
    normalized = true,
    embedding_type = 'float',
    batchSize = 256,
    apiKey = process.env.JINA_API_KEY,
    endpoint = 'https://api.jina.ai/v1/embeddings',
    signal,
  }: EmbedViaJinaAPIOptions = {}
): Promise<EmbeddingResult> {
  if (!apiKey) {
    throw new Error('JINA_API_KEY not set in environment; required for provider=jina-api');
  }
  const out: Float32Array[] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const body = {
      model,
      input: batch,
      normalized,
      embedding_type,
    };
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!resp.ok) {
      const tx = await resp.text();
      throw new Error(`Jina API error ${resp.status}: ${tx}`);
    }
    const json = await resp.json() as {
      data: Array<{
        embedding: number[];
        index: number;
        object: string;
      }>;
      model: string;
      usage: any;
    };
    // Response: {data:[{embedding:[...],index:n,object:'embedding'}],model:'...',usage:{...}}
    for (const item of json.data) {
      out[i + item.index] = Float32Array.from(item.embedding);
    }
  }
  const dim = out[0]?.length || 0;
  return { embeddings: out, dim };
}

// ------------------------------
// Local Transformers.js provider
// ------------------------------
// Lazy-load to avoid cost if unused.
let _localPipeline: any = null;

async function getLocalPipeline(
  model: string = 'jinaai/jina-embeddings-v2-base-code',
  { quantized = true }: { quantized?: boolean } = {}
): Promise<any> {
  if (_localPipeline) return _localPipeline;
  // dynamic import because @xenova/transformers is ESM
  const { pipeline } = await import('@xenova/transformers');
  _localPipeline = await pipeline('feature-extraction', model, {
    quantized,
  });
  return _localPipeline;
}

/**
 * Run local model; apply mean pooling & L2 norm (recommended in model card).
 */
async function embedViaLocalTransformers(
  texts: string[],
  { model = 'jinaai/jina-embeddings-v2-base-code', quantized = true, batchSize = 32 }: EmbedViaLocalTransformersOptions = {}
): Promise<EmbeddingResult> {
  const extractor = await getLocalPipeline(model, { quantized });
  const out: Float32Array[] = new Array(texts.length);
  // run in small batches; pipeline can accept array input
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    // {pooling:'mean'} supported per model card example; returns Tensor objects
    const embeddings = await extractor(batch, { pooling: 'mean', normalize: true });
    // embeddings: array of Tensor objects {data:Float32Array,...}
    for (let j = 0; j < batch.length; j++) {
      out[i + j] = embeddings[j].data; // already Float32Array
    }
  }
  const dim = out[0]?.length || 0;
  return { embeddings: out, dim };
}

// ------------------------------
// Main dispatcher
// ------------------------------
async function embedTexts(
  texts: string[],
  {
    provider = 'cheap-hash',
    model = 'jinaai/jina-embeddings-v2-base-code',
    batchSize,
    quantized = true,
    normalized = true,
    embedding_type = 'float',
    apiKey,
    endpoint,
  }: EmbedTextsOptions = {}
): Promise<EmbeddingResult> {
  if (!texts.length) {
    return { embeddings: [], dim: 0 };
  }
  switch (provider) {
    case 'jina-api':
      return await embedViaJinaAPI(texts, { model, normalized, embedding_type, batchSize, apiKey, endpoint });
    case 'local-transformers':
      return await embedViaLocalTransformers(texts, { model, quantized, batchSize });
    case 'cheap-hash':
    default: {
      const dim = 256;
      const embeddings = texts.map(t => cheapHashEmbedding(t, dim));
      return { embeddings, dim };
    }
  }
}

// ------------------------------
// Graph wiring helper
// ------------------------------

async function embedGraphChunks(
  chunks: ChunkNode[],
  opts: EmbedTextsOptions = {}
): Promise<number> {
  // gather codes
  const texts = chunks.map(ch => ch.code || '');
  const { embeddings, dim } = await embedTexts(texts, opts);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk) {
      chunk.embedding = embeddings[i];
      // record dim in meta for persistence
      if (chunk.meta) {
        chunk.meta.embedding_dim = dim;
      } else {
        chunk.meta = { embedding_dim: dim };
      }
    }
  }
  return dim;
}

export {
  embedGraphChunks,
  embedTexts,
  embedViaJinaAPI,
  embedViaLocalTransformers,
  cheapHashEmbedding,
};
