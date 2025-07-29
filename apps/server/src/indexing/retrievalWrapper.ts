import PineconeHandler from "@/indexing/embedding/pineconeService";
import {
  EmbeddingSearchRequest,
  EmbeddingSearchResponse,
} from "@/indexing/types";

// Wrapper used to retrieve code snippets from Pinecone
export async function retrieve(
  request: EmbeddingSearchRequest
): Promise<EmbeddingSearchResponse[]> {
  const pinecone = new PineconeHandler("shadow");
  const response = await pinecone.searchRecords(request);
  return response;
}
