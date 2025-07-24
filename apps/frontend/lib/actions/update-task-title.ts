"use server";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";

export async function updateTaskTitle(taskId: string, userPrompt: string) {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn(`[UPDATE_TASK_TITLE] OpenAI API key not configured, skipping title generation for task ${taskId}`);
      return null;
    }

    // Generate a descriptive title using AI
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      temperature: 0.3,
      maxTokens: 50,
      prompt: `Generate a very concise and descriptive title for a coding task based on the user's prompt. 

Context: You are generating a title for a task that a coding agent will be working on. The title should clearly describe what the agent will be doing, be professional, and be under 60 characters.

User prompt: "${userPrompt}"

Generate only the title, nothing else:`,
    });

    const generatedTitle = text
      .trim()
      .replace(/^[`"']|[`"']$/g, "") // Remove leading/trailing quotes or backticks
      .replace(/[`"']/g, ""); // Remove any remaining quotes or backticks within the string

    // Update the task in the database
    await prisma.task.update({
      where: { id: taskId },
      data: { title: generatedTitle },
    });

    // Revalidate the pages that show task data
    revalidatePath("/");
    revalidatePath(`/tasks/${taskId}`);

    console.log(`[UPDATE_TASK_TITLE] Generated title for task ${taskId}: "${generatedTitle}"`);
    
    return generatedTitle;
  } catch (error) {
    console.error(`[UPDATE_TASK_TITLE] Failed to generate title for task ${taskId}:`, error);
    // Don't throw error, just log it - title generation is not critical
    return null;
  }
}