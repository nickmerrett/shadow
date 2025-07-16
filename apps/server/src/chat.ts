import { prisma } from "@repo/db";
import { Message, MessageMetadata, ModelType } from "@repo/types";
import { randomUUID } from "crypto";
import { LLMService } from "./llm";
import { systemPrompt } from "./prompt/system";
import {
  emitStreamChunk,
  endStream,
  handleStreamError,
  startStream,
} from "./socket";

export const DEFAULT_MODEL: ModelType = "gpt-4o";

export class ChatService {
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService();
  }

  async saveUserMessage(
    taskId: string,
    content: string,
    metadata?: MessageMetadata
  ) {
    return await prisma.chatMessage.create({
      data: {
        taskId,
        content,
        role: "USER",
        metadata: (metadata as any) || undefined,
      },
    });
  }

  async saveAssistantMessage(
    taskId: string,
    content: string,
    llmModel: string,
    metadata?: MessageMetadata
  ) {
    // Extract usage info for denormalized storage
    const usage = metadata?.usage;

    return await prisma.chatMessage.create({
      data: {
        taskId,
        content,
        role: "ASSISTANT",
        llmModel,
        metadata: (metadata as any) || undefined,
        // Denormalized usage fields for easier querying
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
        finishReason: metadata?.finishReason,
      },
    });
  }

  async saveToolMessage(
    taskId: string,
    toolName: string,
    toolArgs: Record<string, any>,
    toolResult: string,
    metadata?: MessageMetadata
  ) {
    return await prisma.chatMessage.create({
      data: {
        taskId,
        content: toolResult,
        role: "TOOL",
        metadata: {
          ...(metadata as any),
          tool: {
            name: toolName,
            args: toolArgs,
            status: "success",
            result: toolResult,
          },
        } as any,
      },
    });
  }

  async getChatHistory(taskId: string): Promise<Message[]> {
    const dbMessages = await prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    return dbMessages.map((msg) => ({
      id: msg.id,
      role: msg.role.toLowerCase() as Message["role"],
      content: msg.content,
      llmModel: msg.llmModel || undefined,
      createdAt: msg.createdAt.toISOString(),
      metadata: msg.metadata as MessageMetadata | undefined,
    }));
  }

  async processUserMessage(
    taskId: string,
    userMessage: string,
    llmModel: ModelType = DEFAULT_MODEL,
    enableTools: boolean = true
  ) {
    // Save user message to database
    await this.saveUserMessage(taskId, userMessage);

    // Get chat history for context
    const history = await this.getChatHistory(taskId);

    // Prepare messages for LLM (exclude the user message we just saved to avoid duplication)
    const messages: Message[] = history
      .slice(0, -1) // Remove the last message (the one we just saved)
      .filter(
        (msg) =>
          msg.role === "user" || msg.role === "assistant" || msg.role === "tool"
      )
      .concat([
        {
          id: randomUUID(),
          role: "user",
          content: userMessage,
          createdAt: new Date().toISOString(),
        },
      ]);

    console.log(
      `[CHAT] Processing message for task ${taskId} with ${messages.length} context messages`
    );
    console.log(
      `[CHAT] Using model: ${llmModel}, Tools enabled: ${enableTools}`
    );

    // Start streaming
    startStream();

    let fullAssistantResponse = "";
    let usageMetadata: MessageMetadata["usage"];
    let finishReason: MessageMetadata["finishReason"];
    const toolCalls: Array<{
      id: string;
      name: string;
      args: Record<string, any>;
    }> = [];
    const toolResults: Array<{ id: string; result: string }> = [];

    try {
      for await (const chunk of this.llmService.createMessageStream(
        systemPrompt,
        messages,
        llmModel,
        enableTools
      )) {
        // Emit the chunk directly to clients
        emitStreamChunk(chunk);

        // Accumulate content for database storage
        if (chunk.type === "content" && chunk.content) {
          fullAssistantResponse += chunk.content;
        }

        // Track tool calls
        if (chunk.type === "tool-call" && chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          console.log(
            `[TOOL_CALL] ${chunk.toolCall.name}:`,
            chunk.toolCall.args
          );
        }

        // Track tool results
        if (chunk.type === "tool-result" && chunk.toolResult) {
          toolResults.push(chunk.toolResult);
          console.log(
            `[TOOL_RESULT] ${chunk.toolResult.id}:`,
            chunk.toolResult.result
          );
        }

        // Track usage information
        if (chunk.type === "usage" && chunk.usage) {
          usageMetadata = {
            promptTokens: chunk.usage.promptTokens,
            completionTokens: chunk.usage.completionTokens,
            totalTokens: chunk.usage.totalTokens,
            // Include provider-specific tokens if available
            cacheCreationInputTokens: chunk.usage.cacheCreationInputTokens,
            cacheReadInputTokens: chunk.usage.cacheReadInputTokens,
          };
        }

        // Track finish reason
        if (
          chunk.type === "complete" &&
          chunk.finishReason &&
          chunk.finishReason !== "error"
        ) {
          finishReason = chunk.finishReason;
        }
      }

      // Save assistant response to database with metadata
      const assistantMetadata: MessageMetadata = {
        usage: usageMetadata,
        finishReason,
      };

      await this.saveAssistantMessage(
        taskId,
        fullAssistantResponse,
        llmModel,
        assistantMetadata
      );

      // Save tool calls and results to database
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        const toolResult = toolResults.find((r) => r.id === toolCall.id);

        if (toolResult) {
          await this.saveToolMessage(
            taskId,
            toolCall.name,
            toolCall.args,
            toolResult.result,
            {
              tool: {
                name: toolCall.name,
                args: toolCall.args,
                status: "success",
                result: toolResult.result,
              },
            }
          );
        }
      }

      console.log(`[CHAT] Completed processing for task ${taskId}`);
      console.log(
        `[CHAT] Response length: ${fullAssistantResponse.length} chars`
      );
      console.log(`[CHAT] Tool calls executed: ${toolCalls.length}`);

      endStream();
    } catch (error) {
      console.error("Error processing user message:", error);

      // Emit error chunk
      emitStreamChunk({
        type: "error",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        finishReason: "error",
      });

      handleStreamError(error);
      throw error;
    }
  }

  // Get available models from LLM service
  getAvailableModels(): ModelType[] {
    return this.llmService.getAvailableModels();
  }

  // Method to process coding tasks with specific configuration
  async processCodingTask(
    taskId: string,
    userMessage: string,
    llmModel: ModelType = DEFAULT_MODEL
  ) {
    console.log(`[CODING_TASK] Starting coding task for ${taskId}`);
    console.log(`[CODING_TASK] Task: ${userMessage.substring(0, 100)}...`);

    return this.processUserMessage(taskId, userMessage, llmModel, true);
  }
}
