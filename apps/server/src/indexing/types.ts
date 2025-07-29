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
  chunk_text: string; // This is the field that gets embedded
  [key: string]: any; // Index signature for Pinecone SDK compatibility
}