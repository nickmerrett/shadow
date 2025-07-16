import { LLMMessage, Message, MessageMetadata } from "@repo/types";
import { prisma } from "../../../packages/db/src/client";
import { LLMService } from "./llm";
import {
  emitStreamChunk,
  endStream,
  handleStreamError,
  startStream,
} from "./socket";

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
    return await prisma.chatMessage.create({
      data: {
        taskId,
        content,
        role: "ASSISTANT",
        llmModel,
        metadata: (metadata as any) || undefined,
      },
    });
  }

  async getChatHistory(taskId: string): Promise<Message[]> {
    const dbMessages = await prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    console.log("dbMessages", dbMessages);

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
    llmModel: string = "claude-3-5-sonnet-20241022"
  ) {
    // Save user message to database
    await this.saveUserMessage(taskId, userMessage);

    // Get chat history for context
    const history = await this.getChatHistory(taskId);

    // Prepare messages for LLM (exclude the user message we just saved to avoid duplication)
    const messages: LLMMessage[] = history
      .slice(0, -1) // Remove the last message (the one we just saved)
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))
      .concat([{ role: "user", content: userMessage }]);

    const systemPrompt = `You are a helpful coding assistant. You help users with their programming tasks by providing clear, accurate, and helpful responses.`;

    // Start streaming
    startStream();

    let fullAssistantResponse = "";
    let usageMetadata: MessageMetadata["usage"];

    try {
      for await (const chunk of this.llmService.createMessageStream(
        systemPrompt,
        messages,
        llmModel
      )) {
        // Emit the chunk directly to clients
        emitStreamChunk(chunk);

        // Accumulate content for database storage
        if (chunk.type === "content" && chunk.content) {
          fullAssistantResponse += chunk.content;
        }

        // Track usage information
        if (chunk.type === "usage" && chunk.usage) {
          usageMetadata = chunk.usage;
        }
      }

      // Save assistant response to database with metadata
      await this.saveAssistantMessage(
        taskId,
        fullAssistantResponse,
        llmModel,
        usageMetadata ? { usage: usageMetadata } : undefined
      );

      endStream();
    } catch (error) {
      console.error("Error processing user message:", error);

      // Emit error chunk
      emitStreamChunk({
        type: "error",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });

      handleStreamError(error);
      throw error;
    }
  }
}
