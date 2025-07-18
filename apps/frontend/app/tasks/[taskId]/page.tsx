import { TaskPageContent } from "@/components/chat/task";
import { ContentLayout } from "@/components/layout/content";
import { getTask } from "@/lib/db-operations/get-task";
import { getTaskMessages } from "@/lib/db-operations/get-task-messages";
import { notFound } from "next/navigation";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;

  const task = await getTask(taskId);
  if (!task) {
    notFound();
  }

  const messages = await getTaskMessages(taskId);

  return (
    <ContentLayout 
      leftContent={<TaskPageContent task={task} initialMessages={messages} />}
    />
  );
}
