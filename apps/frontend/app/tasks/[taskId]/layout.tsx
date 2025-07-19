import { TaskLayoutContent } from "@/components/layout/task-layout";
import { cookies } from "next/headers";

export default async function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <TaskLayoutContent initialLayout={initialLayout}>
      {children}
    </TaskLayoutContent>
  );
}
