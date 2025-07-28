import { db, CodebaseUnderstanding } from "@repo/db";

export type CodebaseWithTasks = CodebaseUnderstanding & {
  tasks: { id: string }[];
};

export async function getCodebase(
  codebaseId: string
): Promise<CodebaseWithTasks | null> {
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

    return codebase;
  } catch (err) {
    console.error("Failed to fetch codebase", err);
    return null;
  }
}
