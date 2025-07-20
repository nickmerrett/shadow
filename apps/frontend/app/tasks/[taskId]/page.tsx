import { TaskPageLayout } from "@/components/task/task-layout";
import { getUser } from "@/lib/auth/get-user";
import { getTask } from "@/lib/db-operations/get-task";
import { getTaskMessages } from "@/lib/db-operations/get-task-messages";
import {
  getGitHubRepositories,
  getGitHubStatus,
} from "@/lib/github/github-api";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [user, task] = await Promise.all([
    getUser(),
    getTask((await params).taskId),
  ]);

  if (!task) {
    notFound();
  }

  const queryClient = new QueryClient();

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

  // Prefetch data with individual error handling - GitHub failures won't break the page
  const prefetchPromises = [
    // Task messages are critical - let this throw if it fails
    queryClient.prefetchQuery({
      queryKey: ["task-messages", taskId],
      queryFn: () => getTaskMessages(taskId),
    }),
    // GitHub prefetches are optional - catch their errors
    queryClient
      .prefetchQuery({
        queryKey: ["github", "status"],
        queryFn: () => getGitHubStatus(user?.id),
      })
      .catch((error) => {
        console.log(
          "Could not prefetch GitHub status:",
          error?.message || error
        );
      }),
    queryClient
      .prefetchQuery({
        queryKey: ["github", "repositories"],
        queryFn: () => getGitHubRepositories(user?.id),
      })
      .catch((error) => {
        console.log(
          "Could not prefetch GitHub repositories:",
          error?.message || error
        );
      }),
  ];

  const [initialLayout] = await Promise.all([
    getInitialLayout(),
    ...prefetchPromises,
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TaskPageLayout initialLayout={initialLayout} />
    </HydrationBoundary>
  );
}
