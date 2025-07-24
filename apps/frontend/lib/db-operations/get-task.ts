import { db } from "@repo/db";

export type Task = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  repoUrl: string;
  baseBranch: string | null;
  shadowBranch: string | null;
  mode: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
};

export async function getTask(taskId: string): Promise<Task | null> {
  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!task) {
      return null;
    }

    return {
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch task", err);
    return null;
  }
}
