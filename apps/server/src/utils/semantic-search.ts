import fetch from "node-fetch";
import config from "../config";
import { EmbeddingSearchResult } from "../indexing/embedding/types";
import { CodebaseSearchToolResult } from "@repo/types";

export interface SemanticSearchParams {
  query: string;
  repo: string;
  topK?: number;
  fields?: string[];
}

export interface SemanticSearchResponse {
  matches: EmbeddingSearchResult[];
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
  const matches = data.matches;

  const parsedData: CodebaseSearchToolResult = {
    success: !!matches,
    results: matches.map((match: EmbeddingSearchResult, i: number) => ({
      id: i + 1,
      content: match?.fields?.code || match?.fields?.text || "",
      relevance: typeof match?._score === "number" ? match._score : 0.8,
    })),
    query,
    searchTerms: query.split(/\s+/),
    message: matches?.length
      ? `Found ${matches.length} relevant code snippets for "${query}"`
      : `No relevant code found for "${query}"`,
  };

  console.log("semanticSearch output", parsedData);
  return parsedData;
}