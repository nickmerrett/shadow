"use server";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  cleanTitle,
  generateShadowBranchName,
  getTitleGenerationModel,
} from "@repo/types";
import { getApiKeys } from "./api-keys";

export async function generateTaskTitleAndBranch(
  taskId: string,
  userPrompt: string
) {
  try {
    // Get API keys from cookies
    const apiKeys = await getApiKeys();

    const modelConfig = getTitleGenerationModel({
      taskId,
      userPrompt,
      apiKeys,
    });

    if (!modelConfig) {
      console.warn(
        `[GENERATE_TITLE_BRANCH] No API keys provided, skipping title generation for task ${taskId}`
      );
      return {
        title: userPrompt.slice(0, 50),
        shadowBranch: `shadow/task-${taskId}`,
      };
    }

    const model =
      modelConfig.provider === "openai"
        ? createOpenAI({ apiKey: apiKeys.openai })(modelConfig.modelChoice)
        : modelConfig.provider === "anthropic"
        ? createAnthropic({ apiKey: apiKeys.anthropic })(modelConfig.modelChoice)
        : createOpenRouter({ apiKey: apiKeys.openrouter! }).chat(modelConfig.modelChoice);

    const { text: generatedText } = await generateText({
      model,
      temperature: 0.3,
      prompt: `Generate a concise title (under 50 chars) for this coding task:

"${userPrompt}"

Return ONLY the title.`,
    });

    const title = cleanTitle(generatedText);

    console.log(
      `[GENERATE_TITLE_BRANCH] Generated title for task ${taskId}: "${title}" using ${modelConfig.provider} ${modelConfig.modelChoice}`
    );

    return { title, shadowBranch: generateShadowBranchName(title, taskId) };
  } catch (error) {
    console.error(
      `[GENERATE_TITLE_BRANCH] Failed to generate title for task ${taskId}:`,
      error
    );
    // Don't throw error, just log it - title generation is not critical
    return {
      title: userPrompt.slice(0, 50),
      shadowBranch: `shadow/task-${taskId}`,
    };
  }
}
