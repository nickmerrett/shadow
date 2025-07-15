import { TaskPageContent } from "@/components/chat/task";
import { Message } from "@repo/types";

export type Task = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  repoUrl: string;
  branch: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
};

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;

  const taskData = await fetch(`http://localhost:4000/api/tasks/${taskId}`);
  const task = (await taskData.json()) as Task;

  const messagesData = await fetch(
    `http://localhost:4000/api/tasks/${taskId}/messages`
  );
  const { messages } = (await messagesData.json()) as { messages: Message[] };

  return <TaskPageContent task={task} initialMessages={messages} />;
}
