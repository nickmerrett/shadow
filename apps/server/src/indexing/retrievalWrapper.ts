import PineconeHandler from "@/indexing/embedding/pineconeService";
import {
  EmbeddingSearchRequest,
  EmbeddingSearchResponse,
} from "@/indexing/types";

// Wrapper used to retrieve code snippets from Pinecone
// Overloaded function signature for backward compatibility
export async function retrieve(
  query: string,
  namespace: string,
  topK: number
): Promise<EmbeddingSearchResponse[]>;
export async function retrieve(
  request: EmbeddingSearchRequest
): Promise<EmbeddingSearchResponse[]>;

// Implementation of the overloaded function
export async function retrieve(
  arg1: string | EmbeddingSearchRequest,
  arg2?: string,
  arg3?: number
): Promise<EmbeddingSearchResponse[]> {
  const pinecone = new PineconeHandler("shadow");

  let request: EmbeddingSearchRequest;

  if (typeof arg1 === "string" && arg2 !== undefined && arg3 !== undefined) {
    // Old signature: construct EmbeddingSearchRequest from parameters
    request = {
      query: arg1,
      namespace: arg2,
      topK: arg3,
    };
  } else if (typeof arg1 === "object") {
    // New signature: use the provided EmbeddingSearchRequest object
    request = arg1;
  } else {
    throw new Error("Invalid arguments provided to retrieve function.");
  }
  const response = await pinecone.searchRecords(request);
  // Returns an array of hits
  return response;
}
