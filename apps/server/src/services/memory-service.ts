import { prisma } from "@repo/db";

export interface MemoryContext {
  globalMemories: Array<{
    id: string;
    content: string;
    category: string;
    createdAt: Date;
  }>;
  repositoryMemories: Array<{
    id: string;
    content: string;
    category: string;
    createdAt: Date;
  }>;
}

export class MemoryService {
  /**
   * Get relevant memories for a task context
   */
  async getMemoriesForTask(taskId: string): Promise<MemoryContext | null> {
    try {
      // Get task info
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { 
          repoFullName: true, 
          userId: true,
          user: {
            select: {
              settings: {
                select: {
                  memoriesEnabled: true,
                },
              },
            },
          },
        },
      });

      if (!task) {
        console.warn(`[MEMORY_SERVICE] Task ${taskId} not found`);
        return null;
      }

      // Check if memories are enabled
      if (!task.user.settings?.memoriesEnabled) {
        return null;
      }

      // Get both global and repository-specific memories
      const memories = await prisma.memory.findMany({
        where: {
          userId: task.userId,
          OR: [
            { isGlobal: true },
            { 
              AND: [
                { isGlobal: false },
                { repoFullName: task.repoFullName },
              ],
            },
          ],
        },
        orderBy: [
          { category: "asc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          content: true,
          category: true,
          isGlobal: true,
          createdAt: true,
        },
      });

      // Split into global and repository memories
      const globalMemories = memories
        .filter((m) => m.isGlobal)
        .map((m) => ({
          id: m.id,
          content: m.content,
          category: m.category,
          createdAt: m.createdAt,
        }));

      const repositoryMemories = memories
        .filter((m) => !m.isGlobal)
        .map((m) => ({
          id: m.id,
          content: m.content,
          category: m.category,
          createdAt: m.createdAt,
        }));

      return {
        globalMemories,
        repositoryMemories,
      };
    } catch (error) {
      console.error(`[MEMORY_SERVICE] Error fetching memories for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Format memories into a string for system prompt inclusion
   */
  formatMemoriesForPrompt(memoryContext: MemoryContext): string {
    if (!memoryContext || (memoryContext.globalMemories.length === 0 && memoryContext.repositoryMemories.length === 0)) {
      return "";
    }

    let formattedMemories = "\n\n## MEMORIES\n\nRelevant memories from previous sessions:\n";

    // Add global memories
    if (memoryContext.globalMemories.length > 0) {
      formattedMemories += "\n### Global User Preferences & Patterns:\n";
      memoryContext.globalMemories.forEach((memory) => {
        formattedMemories += `- [${memory.category}] ${memory.content}\n`;
      });
    }

    // Add repository memories
    if (memoryContext.repositoryMemories.length > 0) {
      formattedMemories += "\n### Repository-Specific Context:\n";
      memoryContext.repositoryMemories.forEach((memory) => {
        formattedMemories += `- [${memory.category}] ${memory.content}\n`;
      });
    }

    formattedMemories += "\nUse these memories to inform your responses and maintain consistency with past work and preferences.\n";

    return formattedMemories;
  }

  /**
   * Create a system prompt with memory context included
   */
  async createSystemPromptWithMemories(baseSystemPrompt: string, taskId: string): Promise<string> {
    const memoryContext = await this.getMemoriesForTask(taskId);
    
    if (!memoryContext) {
      return baseSystemPrompt;
    }

    const memoryPrompt = this.formatMemoriesForPrompt(memoryContext);
    return baseSystemPrompt + memoryPrompt;
  }
}

// Export singleton instance
export const memoryService = new MemoryService();