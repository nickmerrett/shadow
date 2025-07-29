import fetch from "node-fetch";
import config from "../config";
import { EmbeddingSearchResponse } from "@/indexing/types";
import { CodebaseSearchToolResult } from "@repo/types";

export interface SemanticSearchParams {
  query: string;
  repo: string;
  topK?: number;
  fields?: string[];
}

export interface SemanticSearchResponse {
  hits: EmbeddingSearchResponse[];
}

export async function performSemanticSearch(
  params: SemanticSearchParams
): Promise<CodebaseSearchToolResult> {
  const { query, repo, topK = 5, fields = ["content", "filePath", "language"] } = params;

  console.log("semanticSearch enabled");
  console.log("semanticSearchParams", query, repo);

  const response = await fetch(`${config.apiUrl}/api/indexing/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      namespace: repo,
      topK,
      fields,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Indexing service error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as SemanticSearchResponse;
  const hits = data.hits;

  const parsedData: CodebaseSearchToolResult = {
    success: !!hits,
    results: hits.map((hit: EmbeddingSearchResponse, i: number) => ({
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
}