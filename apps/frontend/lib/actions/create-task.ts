"use server";

import { auth } from "@/lib/auth/auth";
import { MessageRole, prisma, Task } from "@repo/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

export async function createTask(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const message = formData.get("message") as string;
  const model = formData.get("model") as string;
  const repoUrl = formData.get("repoUrl") as string;
  const baseBranch = (formData.get("baseBranch") as string);
  const baseCommitSha = formData.get("baseCommitSha") as string;

  if (!message?.trim()) {
    throw new Error("Message is required");
  }

  if (!model) {
    throw new Error("Model is required");
  }

  const taskId = crypto.randomUUID();
  const shadowBranch = `shadow/task-${taskId}`;
  let task: Task;

  try {
    // Create the task
    task = await prisma.task.create({
      data: {
        id: taskId,
        title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        description: message,
        repoUrl,
        baseBranch,
        shadowBranch,
        baseCommitSha,
        status: "INITIALIZING",
        mode: "FULL_AUTO",
        user: {
          connect: {
            id: session.user.id,
          },
        },
        messages: {
          create: {
            content: message,
            role: MessageRole.USER,
            sequence: 1,
          },
        },
      },
    });

    // Schedule the backend API call to happen after the response is sent
    after(async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
        const response = await fetch(
          `${baseUrl}/api/tasks/${task.id}/initiate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message,
              model,
              userId: session.user.id,
            }),
          }
        );

        if (!response.ok) {
          console.error("Failed to initiate task:", await response.text());
        } else {
          console.log("Task initiated successfully:", task.id);
        }
      } catch (error) {
        console.error("Error initiating task:", error);
      }
    });

    revalidatePath("/");
  } catch (error) {
    console.error("Failed to create task:", error);
    throw new Error("Failed to create task");
  }

  return task.id;
}
