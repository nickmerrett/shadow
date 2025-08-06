import { Message, ModelType, StreamChunk, getAvailableModels } from "@repo/types";
import type { ToolSet } from "ai";
import { StreamProcessor } from "./streaming/stream-processor";
import { PRGenerator } from "./pr-generation/pr-generator";

export class LLMService {
  private streamProcessor = new StreamProcessor();
  private prGenerator = new PRGenerator();

  /**
   * Create a streaming response for LLM messages with tool support
   */
  async *createMessageStream(
    systemPrompt: string,
    messages: Message[],
    model: ModelType,
    userApiKeys: { openai?: string; anthropic?: string },
    enableTools: boolean = true,
    taskId: string,
    workspacePath?: string,
    abortSignal?: AbortSignal,
    preCreatedTools?: ToolSet
  ): AsyncGenerator<StreamChunk> {
    yield* this.streamProcessor.createMessageStream(
      systemPrompt,
      messages,
      model,
      userApiKeys,
      enableTools,
      taskId,
      workspacePath,
      abortSignal,
      preCreatedTools
    );
  }

  /**
   * Get available models based on user API keys
   */
  getAvailableModels(userApiKeys: {
    openai?: string;
    anthropic?: string;
  }): ModelType[] {
    return getAvailableModels(userApiKeys);
  }

  /**
   * Generate PR metadata using LLM based on task context and git changes
   */
  async generatePRMetadata(
    options: {
      taskTitle: string;
      gitDiff: string;
      commitMessages: string[];
      wasTaskCompleted: boolean;
    },
    userApiKeys: { openai?: string; anthropic?: string }
  ): Promise<{
    title: string;
    description: string;
    isDraft: boolean;
  }> {
    return this.prGenerator.generatePRMetadata(options, userApiKeys);
  }
}
