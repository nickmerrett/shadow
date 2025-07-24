import { db, Task } from "@repo/db";

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

    return task;
  } catch (err) {
    console.error("Failed to fetch task", err);
    return null;
  }
}
