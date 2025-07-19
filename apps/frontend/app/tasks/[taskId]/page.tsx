import { TaskPageLayout } from "@/components/task/task-layout";
import { getTask } from "@/lib/db-operations/get-task";
import { getTaskMessages } from "@/lib/db-operations/get-task-messages";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const getInitialLayout = async () => {
    const cookieStore = await cookies();
    const taskLayoutCookie = cookieStore.get("resizable-task-layout");

    let initialLayout: number[] | undefined;
    if (taskLayoutCookie?.value) {
      try {
        initialLayout = JSON.parse(taskLayoutCookie.value);
      } catch {
        // Invalid JSON, ignore
      }
    }

    return initialLayout;
  };

  const getTaskAndMessages = async () => {
    const { taskId } = await params;

    const task = await getTask(taskId);
    if (!task) {
      notFound();
    }

    const messages = await getTaskMessages(taskId);

    return { task, messages };
  };

  const [initialLayout, { task, messages }] = await Promise.all([
    getInitialLayout(),
    getTaskAndMessages(),
  ]);

  return (
    <TaskPageLayout
      initialLayout={initialLayout}
      task={task}
      messages={messages}
    />
  );
}
