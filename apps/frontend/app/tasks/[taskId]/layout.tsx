import { SidebarComponent } from "@/components/sidebar";
import { getUser } from "@/lib/auth/get-user";
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

  return (
    <>
      <SidebarComponent currentTaskId={taskId} initialTasks={initialTasks} />
      {children}
    </>
  );
}
