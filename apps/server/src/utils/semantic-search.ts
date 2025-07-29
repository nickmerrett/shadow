import { retrieveCodeChunks } from "@/indexing/codebase-retrieval";
import { getNamespaceFromRepo, isValidRepo } from "@/indexing/utils/repository";
import { CodebaseSearchResponse } from "@/indexing/codebase-types";
import { CodebaseSearchToolResult } from "@repo/types";

export interface SemanticSearchParams {
  query: string;
  repo: string;
  topK?: number;
  fields?: string[];
}

export interface SemanticSearchResponse {
  hits: CodebaseSearchResponse[];
}

export async function performSemanticSearch(
  params: SemanticSearchParams
): Promise<CodebaseSearchToolResult> {
  const { query, repo, topK = 5 } = params;

  let namespaceToUse = repo;
  if (isValidRepo(repo)) {
    namespaceToUse = getNamespaceFromRepo(repo);
  }

  try {
    const hits = await retrieveCodeChunks({
      query,
      namespace: namespaceToUse,
      topK,
    });

    const parsedData: CodebaseSearchToolResult = {
      success: !!hits,
      results: hits.map((hit: CodebaseSearchResponse, i: number) => ({
        id: i + 1,
        content: hit?.fields?.code || "",
        relevance: typeof hit?._score === "number" ? hit._score : 0.8,
      })),
      query,
      searchTerms: query.split(/\s+/),
      message: hits?.length
        ? `Found ${hits.length} relevant code snippets for "${query}"`
        : `No relevant code found for "${query}"`,
    };

    console.log("semanticSearch output", parsedData);
    return parsedData;
  } catch (error) {
    console.error("[SEMANTIC_SEARCH_ERROR]", error);
    return {
      success: false,
      results: [],
      query,
      searchTerms: query.split(/\s+/),
      message: `Semantic search failed for "${query}"`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
