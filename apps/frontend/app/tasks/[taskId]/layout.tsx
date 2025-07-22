import { SidebarViews } from "@/components/sidebar";
import { getUser } from "@/lib/auth/get-user";
import { getTaskWithDetails } from "@/lib/db-operations/get-task-with-details";
import { getTasks } from "@/lib/db-operations/get-tasks";

export default async function TaskLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ taskId: string }>;
}>) {
  const user = await getUser();
  const initialTasks = user ? await getTasks(user.id) : [];

  const { taskId } = await params;

  // Fetch complete task details including todos and file changes
  const taskDetails = await getTaskWithDetails(taskId);

  // Transform to match SidebarViews interface
  const currentTask = taskDetails.task
    ? {
        taskData: taskDetails.task,
        todos: taskDetails.todos,
        fileChanges: taskDetails.fileChanges,
      }
    : null;

  return (
    <>
      <SidebarViews initialTasks={initialTasks} currentTask={currentTask} />
      {children}
    </>
  );
}
