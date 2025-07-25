"use server";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { prisma } from "@repo/db";

function cleanTitle(title: string) {
  return title
    .trim()
    .replace(/^[`"']|[`"']$/g, "") // Remove leading/trailing quotes or backticks
    .replace(/[`"']/g, ""); // Remove any remaining quotes or backticks within the string
}

export async function updateTaskTitle(taskId: string, userPrompt: string) {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn(`[UPDATE_TASK_TITLE] OpenAI API key not configured, skipping title generation for task ${taskId}`);
      return null;
    }

    // Generate a descriptive title using AI
    const { text: generatedText } = await generateText({
      model: openai("gpt-4o-mini"),
      temperature: 0.3,
      prompt: `Generate a concise title (under 50 chars) for this coding task:

"${userPrompt}"

Return ONLY the title.`,
    });

    const title = cleanTitle(generatedText);

    await prisma.task.update({
      where: { id: taskId },
      data: { title },
    });

    console.log(`[UPDATE_TASK_TITLE] Generated title for task ${taskId}: "${title}"`);

    return title;
  } catch (error) {
    console.error(`[UPDATE_TASK_TITLE] Failed to generate title for task ${taskId}:`, error);
    // Don't throw error, just log it - title generation is not critical
    return null;
  }
}