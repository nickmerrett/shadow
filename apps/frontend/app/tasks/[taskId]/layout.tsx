import { SidebarViews } from "@/components/sidebar";
import { AgentEnvironmentProvider } from "@/components/agent-environment/agent-environment-context";
import { getApiKeys, getModels } from "@/lib/actions/api-keys";
import { getUser } from "@/lib/auth/get-user";
import { getTaskMessages } from "@/lib/db-operations/get-task-messages";
import { getTaskWithDetails } from "@/lib/db-operations/get-task-with-details";
import { getTasks } from "@/lib/db-operations/get-tasks";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { getCodebases } from "@/lib/db-operations/get-codebases";

// Helper function for timing operations in development
async function timeOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  return { result, duration };
}

export default async function TaskLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ taskId: string }>;
}>) {
  const timings: Record<string, number> = {};
  
  const { taskId } = await params;
  
  const { result: user, duration: userDuration } = await timeOperation("getUser", () => getUser());
  timings.getUser = userDuration;
  
  const { result: initialDataResults, duration: initialDataDuration } = await timeOperation(
    "Initial Data",
    () => Promise.all([
      user ? getTasks(user.id) : [],
      user ? getCodebases(user.id) : [],
      getTaskWithDetails(taskId),
      getTaskMessages(taskId),
    ])
  );
  timings.initialData = initialDataDuration;
  
  const [
    initialTasks,
    initialCodebases,
    { task, todos, fileChanges, diffStats },
    taskMessages,
  ] = initialDataResults;

  if (!task) {
    notFound();
  }

  const queryClient = new QueryClient();
  
  const prefetchTimings: Record<string, number> = {};

  const taskDataPromise = timeOperation("Task Data", () =>
    queryClient.prefetchQuery({
      queryKey: ["task", taskId],
      queryFn: () => ({
        task,
        todos,
        fileChanges,
        diffStats,
      }),
    })
  ).then(({ result, duration }) => {
    prefetchTimings.taskData = duration;
    return result;
  });

  const taskMessagesPromise = timeOperation("Task Messages", () =>
    queryClient.prefetchQuery({
      queryKey: ["task-messages", taskId],
      queryFn: () => taskMessages,
    })
  ).then(({ result, duration }) => {
    prefetchTimings.taskMessages = duration;
    return result;
  });

  const taskTitlePromise = timeOperation("Task Title", () =>
    queryClient.prefetchQuery({
      queryKey: ["task-title", taskId],
      queryFn: () => task.title,
    })
  ).then(({ result, duration }) => {
    prefetchTimings.taskTitle = duration;
    return result;
  });

  const taskStatusPromise = timeOperation("Task Status", () =>
    queryClient.prefetchQuery({
      queryKey: ["task-status", taskId],
      queryFn: () => ({
        status: task.status,
        initStatus: task.initStatus,
        initializationError: task.initializationError,
      }),
    })
  ).then(({ result, duration }) => {
    prefetchTimings.taskStatus = duration;
    return result;
  });

  const apiKeysPromise = timeOperation("API Keys", () =>
    queryClient.prefetchQuery({
      queryKey: ["api-keys"],
      queryFn: getApiKeys,
    })
  ).then(({ result, duration }) => {
    prefetchTimings.apiKeys = duration;
    return result;
  });

  const modelsPromise = timeOperation("Models", () =>
    queryClient
      .prefetchQuery({
        queryKey: ["models"],
        queryFn: getModels,
      })
      .catch((error) => {
        console.log("Could not prefetch models:", error?.message || error);
      })
  ).then(({ result, duration }) => {
    prefetchTimings.models = duration;
    return result;
  });

  const prefetchPromises = [
    taskDataPromise,
    taskMessagesPromise, 
    taskTitlePromise,
    taskStatusPromise,
    apiKeysPromise,
    modelsPromise,
  ];

  const prefetchStart = performance.now();
  await Promise.allSettled(prefetchPromises);
  const prefetchTotal = performance.now() - prefetchStart;
  timings.prefetchTotal = prefetchTotal;

  // Log comprehensive timing summary in development
  if (process.env.NODE_ENV === 'development') {
    const totalTime = Object.values(timings).reduce((sum, time) => sum + time, 0);
    const slowThreshold = 100; // ms
    
    console.log(`\n📋 [Task Layout Timing - ${taskId}]`);
    console.log('├── Individual Operations:');
    console.log(`│   ├── getUser: ${timings.getUser.toFixed(2)}ms${timings.getUser > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log(`│   └── Initial Data: ${timings.initialData.toFixed(2)}ms${timings.initialData > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log('├── Prefetch Operations:');
    console.log(`│   ├── Total Prefetch Time: ${timings.prefetchTotal.toFixed(2)}ms${timings.prefetchTotal > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    if (Object.keys(prefetchTimings).length > 0) {
      console.log(`│   ├── Task Data: ${(prefetchTimings.taskData || 0).toFixed(2)}ms${(prefetchTimings.taskData || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   ├── Task Messages: ${(prefetchTimings.taskMessages || 0).toFixed(2)}ms${(prefetchTimings.taskMessages || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   ├── Task Title: ${(prefetchTimings.taskTitle || 0).toFixed(2)}ms${(prefetchTimings.taskTitle || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   ├── Task Status: ${(prefetchTimings.taskStatus || 0).toFixed(2)}ms${(prefetchTimings.taskStatus || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   ├── API Keys: ${(prefetchTimings.apiKeys || 0).toFixed(2)}ms${(prefetchTimings.apiKeys || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   └── Models: ${(prefetchTimings.models || 0).toFixed(2)}ms${(prefetchTimings.models || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    }
    console.log(`└── Total Time: ${totalTime.toFixed(2)}ms${totalTime > 500 ? ' ⚠️ SLOW' : totalTime > 1000 ? ' 🐌 VERY SLOW' : ''}`);
    console.log('');
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentEnvironmentProvider taskId={taskId}>
        <SidebarViews
          initialTasks={initialTasks}
          initialCodebases={initialCodebases}
          currentTaskId={task.id}
        />
        {children}
      </AgentEnvironmentProvider>
    </HydrationBoundary>
  );
}
