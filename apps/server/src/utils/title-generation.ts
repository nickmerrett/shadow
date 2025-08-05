import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { AvailableModels } from "@repo/types";
import { TaskModelContext } from "../services/task-model-context";

const WORD_LIMIT = 8;

function cleanTitle(title: string) {
  return title
    .trim()
    .replace(/^[`"']|[`"']$/g, "") // Remove leading/trailing quotes or backticks
    .replace(/[`"']/g, ""); // Remove any remaining quotes or backticks within the string
}

function generateRandomSuffix(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateShadowBranchName(title: string, taskId: string): string {
  const branchSafeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
    .trim()
    .split(/\s+/) // Split by whitespace
    .slice(0, WORD_LIMIT) // Limit words
    .join("-") // Join with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  const randomSuffix = generateRandomSuffix(6);

  if (branchSafeTitle) {
    return `shadow/${branchSafeTitle}-${randomSuffix}`;
  } else {
    return `shadow/task-${taskId}`;
  }
}

export async function generateTaskTitleAndBranch(
  taskId: string,
  userPrompt: string,
  context?: TaskModelContext
) {
  try {
    // Get API keys from context if provided
    const userApiKeys = context?.getApiKeys() || {
      openai: undefined,
      anthropic: undefined,
    };

    // Check if any API key is available
    if (!userApiKeys.openai && !userApiKeys.anthropic) {
      console.warn(
        `[GENERATE_TITLE_BRANCH] No API keys provided, skipping title generation for task ${taskId}`
      );
      return {
        title: userPrompt.slice(0, 50),
        shadowBranch: `shadow/task-${taskId}`,
      };
    }

    // Choose mini model based on available API keys for cost optimization
    const modelChoice = userApiKeys.openai
      ? AvailableModels.GPT_4O_MINI
      : AvailableModels.CLAUDE_HAIKU_3_5;

    // Create model instance based on provider
    const model = userApiKeys.openai
      ? openai(modelChoice)
      : anthropic(modelChoice);

    // Generate a descriptive title using AI
    const { text: generatedText } = await generateText({
      model,
      temperature: 0.3,
      prompt: `Generate a concise title (under 50 chars) for this coding task:

"${userPrompt}"

Return ONLY the title.`,
    });

    const title = cleanTitle(generatedText);

    console.log(
      `[GENERATE_TITLE_BRANCH] Generated title for task ${taskId}: "${title}"`
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
