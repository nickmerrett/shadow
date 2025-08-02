import { db, TaskStatus } from "@repo/db";

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const data = await db.task.findUnique({
    where: { id: taskId },
    select: {
      status: true,
    },
  });

  if (!data) {
    throw new Error("Task not found");
  }

  return data.status;
}
