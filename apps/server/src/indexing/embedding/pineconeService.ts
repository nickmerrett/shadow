import { Index, Pinecone } from "@pinecone-database/pinecone";
import config from "../../config";
import { GraphNode } from "../graph";
import logger from "../logger";
import { PineconeBatchRecord, PineconeAutoEmbedRecord } from "../types";
import {
  CodebaseSearchRequest,
  CodebaseSearchResponse,
} from "../codebase-types";

// Handles Pinecone operators
class PineconeHandler {
  public pc: Pinecone;
  private client: Index;
  private embeddingModel: string;
  private indexName: string;
  private isDisabled: boolean;

  // Hardcoded to shadow index for now
  constructor(indexName: string = config.pineconeIndexName) {
    this.pc = new Pinecone({ apiKey: config.pineconeApiKey || "" }); // If no api_key, we can early return
    this.isDisabled = !config.pineconeApiKey; // If no api_key then we can early return
    this.indexName = indexName; // Constant
    this.client = this.pc.Index(this.indexName); // Client attached to the index
    this.embeddingModel = config.embeddingModel; // Constant
  }

  async createIndexForModel() {
    // This function isn't called since the index is always the same
    if (this.isDisabled) {
      logger.warn("[PINECONE_SERVICE] Pinecone is disabled, skipping index creation");
      return;
    }
    // Create the index for the model
    await this.pc.createIndexForModel({
      name: this.indexName,
      cloud: "aws",
      region: "us-east-1",
      embed: {
        model: this.embeddingModel,
        fieldMap: { text: "text" }, // text is the field that will be used for the embedding
      },
      waitUntilReady: true,
    });
  }

  // Clears the namespace
  async clearNamespace(namespace: string): Promise<number> {
    if (this.isDisabled) {
      logger.warn("[PINECONE_SERVICE] Pinecone is disabled, skipping namespace clearing");
      return 0;
    }
    // Delete all the records in the namespace
    try {
      await this.client.namespace(namespace).deleteAll();
      // Cases where this fails:
      // 1. The namespace doesn't exist
      logger.info(`[PINECONE_SERVICE] Namespace "${namespace}" cleared`);
      return 1;
    } catch (err) {
      logger.warn(`[PINECONE_SERVICE] Failed to clear namespace "${namespace}": ${err}`);
      return 0;
    }
  }

  // Upserts the records into the namespace
  async upsertAutoEmbed(
    records: PineconeBatchRecord[],
    namespace: string
  ): Promise<number> {
    if (this.isDisabled) {
      logger.warn("[PINECONE_SERVICE] Pinecone is disabled, skipping upsert");
      return 0;
    }
    try {
      // Convert to upsertRecords format and filter out empty text
      const autoEmbedRecords: PineconeAutoEmbedRecord[] = records
        .map((record) => {
          // Use fullCode for embedding if available, otherwise fall back to code
          const text = record.metadata.fullCode || record.metadata.code || "";
          if (!text.trim()) {
            // logger.info(`[PINECONE_SERVICE] ${record.id} - no text to embed`);
            return null;
          }
          
          // Create metadata without fullCode to avoid size limits
          const { fullCode, ...metadataWithoutFullCode } = record.metadata;
          
          const finalRecord = {
            _id: record.id,
            text: text,
            ...metadataWithoutFullCode,
          };
          
          // Log metadata size for debugging
          // const metadataSize = JSON.stringify(metadataWithoutFullCode).length;
          // const textSize = text.length;
          const totalSize = JSON.stringify(finalRecord).length;
          
          if (totalSize > 35000) { // Log large records
            // logger.warn(`[PINECONE_SERVICE] Large record ${record.id}: metadata=${metadataSize}B, text=${textSize}B, total=${totalSize}B`);
            // logger.warn(`[PINECONE_SERVICE] Metadata keys: ${Object.keys(metadataWithoutFullCode).join(', ')}`);
          }
          
          return finalRecord;
        })
        .filter((record): record is PineconeAutoEmbedRecord => record !== null);

      if (autoEmbedRecords.length === 0) {
        // logger.warn("[PINECONE_SERVICE] No records to upsert");
        return 0; // If there are no records, return 0
      }

      // Use upsertRecords for auto-embedding
      await this.client.namespace(namespace).upsertRecords(autoEmbedRecords); // Pinecone fn
      // logger.info(`[PINECONE_SERVICE] Upserted ${autoEmbedRecords.length} records to Pinecone`);
      return autoEmbedRecords.length;
    } catch (error) {
      logger.error(`[PINECONE_SERVICE] Error upserting records: ${error}`);
      throw error;
    }
  }
  // Chunks Graph records into smaller chunks if there are too many LOC in a batch
  async chunkRecords(
    records: GraphNode[],
    maxLinesPerChunk = 50,
    maxRecordsPerBatch = 100
  ): Promise<GraphNode[][]> {
    const chunks: GraphNode[][] = [];
    let currentChunk: GraphNode[] = [];
    let currentLineSpan = 0;

    for (const record of records) {
      const lineSpan =
        (record.loc?.endLine || 0) - (record.loc?.startLine || 0) + 1;

      const pathChanged =
        currentChunk.length > 0 && currentChunk[0]?.path !== record.path;

      if (
        currentChunk.length >= maxRecordsPerBatch ||
        currentLineSpan + lineSpan > maxLinesPerChunk ||
        pathChanged
      ) {
        if (currentChunk.length > 0) {
          chunks.push([...currentChunk]);
          currentChunk = [];
          currentLineSpan = 0;
        }
      }

      currentChunk.push(record);
      currentLineSpan += lineSpan;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Query the Pinecone index
  async searchRecords(
    request: CodebaseSearchRequest
  ): Promise<CodebaseSearchResponse[]> {
    if (this.isDisabled) {
      logger.warn("[PINECONE_SERVICE] Pinecone is disabled, skipping search");
      return [];
    }
    const response = await this.client
      .namespace(request.namespace)
      .searchRecords({
        query: {
          topK: request.topK || 15,
          inputs: { text: request.query },
        },
      }); // Search based on topK and query
    /*
    {
      "result": {
        "hits": [
          {
            "id": "123",
            "score": 0.98,
            "metadata": {
              "code": "...",
              "path": "...",
              "name": "..."
            }
          }
        ]
      }
    }
    */
    const hits = response.result?.hits || [];
    return hits as CodebaseSearchResponse[];
  }
}

export default PineconeHandler;
