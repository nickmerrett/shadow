import { prisma } from "@repo/db";
import { LLMService } from "./llm";
import {
  createSocketServer,
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

  async saveUserMessage(taskId: string, content: string) {
    return await prisma.chatMessage.create({
      data: {
        taskId,
        content,
        role: "USER",
      },
    });
  }

  async saveAssistantMessage(taskId: string, content: string) {
    return await prisma.chatMessage.create({
      data: {
        taskId,
        content,
        role: "ASSISTANT",
      },
    });
  }

  async getChatHistory(taskId: string) {
    return await prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });
  }

  async processUserMessage(taskId: string, userMessage: string) {
    // Save user message to database
    await this.saveUserMessage(taskId, userMessage);

    // Get chat history for context
    const history = await this.getChatHistory(taskId);

    // Prepare messages for LLM (exclude the user message we just saved to avoid duplication)
    const messages = history
      .slice(0, -1) // Remove the last message (the one we just saved)
      .map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant",
        content: msg.content,
      }))
      .concat([{ role: "user", content: userMessage }]);

    const systemPrompt = `You are a helpful coding assistant. You help users with their programming tasks by providing clear, accurate, and helpful responses.`;

    // Start streaming
    startStream();

    let fullAssistantResponse = "";
    const messageId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;

    try {
      for await (const chunk of this.llmService.createMessageStream(
        systemPrompt,
        messages
      )) {
        if (chunk.type === "text" && chunk.content) {
          fullAssistantResponse += chunk.content;
          const formattedChunk = this.llmService.formatAsOpenAIChunk(
            chunk,
            messageId
          );
          if (formattedChunk) {
            emitStreamChunk(formattedChunk);
          }
        }
      }

      // Send final chunk
      const finalChunk = {
        id: messageId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "claude-3-5-sonnet-20241022",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };
      emitStreamChunk(`data: ${JSON.stringify(finalChunk)}\n\n`);
      emitStreamChunk(`data: [DONE]\n\n`);

      // Save assistant response to database
      await this.saveAssistantMessage(taskId, fullAssistantResponse);

      endStream();
    } catch (error) {
      console.error("Error processing user message:", error);
      handleStreamError(error);
      throw error;
    }
  }
}