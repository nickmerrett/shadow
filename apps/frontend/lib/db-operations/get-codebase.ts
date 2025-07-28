import { db } from "@repo/db";
import { CodebaseWithSummaries } from "@repo/types";
import { getCodebaseSummaries } from "../codebase-understanding/get-summaries";

export async function getCodebase(
  codebaseId: string
): Promise<CodebaseWithSummaries | null> {
  try {
    const codebase = await db.codebaseUnderstanding.findUnique({
      where: { id: codebaseId },
      include: {
        tasks: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!codebase) {
      return null;
    }

    const summaries = getCodebaseSummaries(codebase);

    return { ...codebase, summaries };
  } catch (err) {
    console.error("Failed to fetch codebase", err);
    return null;
  }
}
