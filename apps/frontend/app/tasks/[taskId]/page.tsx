import { TaskPageLayout } from "@/components/task/task-layout";
import { cookies } from "next/headers";

export default async function TaskPage() {
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

  return <TaskPageLayout initialLayout={initialLayout} />;
}
