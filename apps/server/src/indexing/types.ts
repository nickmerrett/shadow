import { GraphNodeKind } from "./graph";

/**
 * Metadata structure for Pinecone records
 * Used in: pineconeService.ts for storing code chunks with their metadata
 * Contains file path, code content, language, line ranges, and node type
 */
export interface PineconeRecordMetadata {
  code: string;
  path: string;
  name: string;
  lang: string;
  line_start: number;
  line_end: number;
  kind: GraphNodeKind;
  [key: string]: any; // Allow additional metadata fields
}

// In the process, Chunk ==> PineconeBatchRecord ==> PineconeAutoEmbedRecord ==> Upsert
/**
 * Standard Pinecone batch record for upserting data
 * Used in: pineconeService.ts upsertAutoEmbed() method
 * Contains unique ID and metadata for batch operations
 */
export interface PineconeBatchRecord {
  id: string; // Unique identifier for the record
  metadata: PineconeRecordMetadata;
}

/**
 * Pinecone auto-embed record with text field for embedding
 * Used in: pineconeService.ts for auto-embedding functionality
 * Extends metadata with _id and text fields required by Pinecone SDK
 */
export interface PineconeAutoEmbedRecord extends PineconeRecordMetadata {
  _id: string;
  text: string; // Standard Pinecone text field for embedding
  [key: string]: any; // Index signature for Pinecone SDK compatibility
}

/**
 * Request structure for embedding search
 * Used in: pineconeService.ts searchRecords() method
 * Contains query text, namespace to search, and number of results to return
 */
export interface EmbeddingSearchRequest {
  query: string;
  namespace: string;
  topK?: number;
}

/**
 * Response structure for embedding search
 * Used in: pineconeService.ts searchRecords() method return value
 * Contains search results with similarity scores and metadata
 */
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
