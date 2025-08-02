import { db, CodebaseUnderstanding } from "@repo/db";

export type SidebarCodebase = Omit<CodebaseUnderstanding, "content"> & {
  tasks: { id: string }[];
};

export async function getCodebases(userId: string): Promise<SidebarCodebase[]> {
  try {
    // Get codebases with documentation
    return await db.codebaseUnderstanding.findMany({
      where: { userId },
      select: {
        id: true,
        repoFullName: true,
        repoUrl: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        tasks: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (err) {
    console.error("Failed to fetch codebases", err);
    return [];
  }
}
