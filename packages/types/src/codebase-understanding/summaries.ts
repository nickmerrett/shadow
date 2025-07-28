import { z } from "zod";
import { CodebaseUnderstanding } from "@repo/db";

export const CodebaseSummarySchema = z.object({
  id: z.string(),
  type: z.enum(["file_summary", "directory_summary", "repo_summary"]),
  fileName: z.string(),
  filePath: z.string(),
  language: z.string(),
  // Either a string or a JSON-stringified object
  content: z.string(),
});

export const CodebaseSummariesSchema = z.array(CodebaseSummarySchema);

export type CodebaseSummary = z.infer<typeof CodebaseSummarySchema>;

export type CodebaseWithSummaries = CodebaseUnderstanding & {
  tasks: { id: string }[];
  summaries: CodebaseSummary[];
};
