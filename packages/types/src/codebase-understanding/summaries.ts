import { z } from "zod";
import { CodebaseUnderstanding } from "@repo/db";

// Simplified schema for the new shallow wiki implementation
export const TaskCodebaseUnderstandingSchema = z.object({
  id: z.string(),
  repoFullName: z.string(),
  repoUrl: z.string(),
  content: z.any(), // JSON object containing summary and structure
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaskCodebaseUnderstanding = z.infer<
  typeof TaskCodebaseUnderstandingSchema
>;

// Legacy schema for backwards compatibility
export const CodebaseSummarySchema = z.object({
  id: z.string(),
  type: z.enum(["file_summary", "directory_summary", "repo_summary"]),
  fileName: z.string(),
  filePath: z.string(),
  language: z.string(),
  content: z.string(),
});

export const CodebaseSummariesSchema = z.array(CodebaseSummarySchema);

export type CodebaseSummary = z.infer<typeof CodebaseSummarySchema>;

export type CodebaseWithSummaries = CodebaseUnderstanding & {
  tasks: { id: string }[];
  summaries: CodebaseSummary[];
};
