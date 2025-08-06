import { generateText } from "ai";
import {
  cleanTitle,
  generateShadowBranchName,
  getTitleGenerationModel,
  ModelType,
} from "@repo/types";
import { TaskModelContext } from "../services/task-model-context";
import { ModelProvider } from "../agent/llm/models/model-provider";

export async function generateTaskTitleAndBranch(
  taskId: string,
  userPrompt: string,
  context: TaskModelContext
): Promise<{ title: string; shadowBranch: string }> {
  try {
    // Get API keys from context if provided
    const apiKeys = context.getApiKeys() || {
      openai: undefined,
      anthropic: undefined,
    };

    // Get the main model to determine provider for mini model selection
    const fallbackModel = context.getMainModel();

    const modelConfig = getTitleGenerationModel({
      taskId,
      userPrompt,
      apiKeys,
      fallbackModel,
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

    const modelProvider = new ModelProvider();
    const model = modelProvider.getModel(
      modelConfig.modelChoice as ModelType,
      apiKeys
    );

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
