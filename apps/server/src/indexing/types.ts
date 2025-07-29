import { GraphNodeKind } from "./graph";

// Pinecone record metadata
export interface PineconeRecordMetadata {
  code: string;
  path: string;
  name: string;
  lang: string;
  line_start: number;
  line_end: number;
  kind: GraphNodeKind;
}

// Pinecone batch record
export interface PineconeBatchRecord {
  id: string;
  metadata: PineconeRecordMetadata;
}

// Pinecone auto-embed record
export interface PineconeAutoEmbedRecord extends PineconeRecordMetadata {
  _id: string;
  text: string; // Standard Pinecone text field for embedding
  chunk_text: string; // This is the field that gets embedded
  [key: string]: any; // Index signature for Pinecone SDK compatibility
}


export interface EmbeddingSearchRequest {
  query: string;
  namespace: string;
  topK?: number;
}

export interface EmbeddingSearchResponse {
  _id: string;
  _score: number;
  fields: {
    code: string;
    path: string;
    name: string;
    lang: string;
    line_start: number;
    line_end: number;
    kind: GraphNodeKind;
  };
}
