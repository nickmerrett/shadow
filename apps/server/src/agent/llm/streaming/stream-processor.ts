import {
  AIStreamChunk,
  Message,
  ModelType,
  StreamChunk,
  ToolName,
  getModelProvider,
  toCoreMessage,
} from "@repo/types";
import {
  CoreMessage,
  streamText,
  generateText,
  NoSuchToolError,
  InvalidToolArgumentsError,
  ToolSet,
} from "ai";
import type { LanguageModelV1FunctionToolCall } from "@ai-sdk/provider";
import { createTools } from "../../tools";
import { ModelProvider } from "../models/model-provider";
import { ChunkHandlers } from "./chunk-handlers";

const MAX_STEPS = 50;

export class StreamProcessor {
  private modelProvider = new ModelProvider();
  private chunkHandlers = new ChunkHandlers();

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
    try {
      const modelInstance = this.modelProvider.getModel(model, userApiKeys);

      // Convert our messages to AI SDK CoreMessage format
      const coreMessages: CoreMessage[] = messages.map(toCoreMessage);

      // Use pre-created tools if provided, otherwise create tools with task context if taskId is provided
      const tools =
        preCreatedTools || (await createTools(taskId, workspacePath));

      const isAnthropicModel = getModelProvider(model) === "anthropic";

      let finalMessages: CoreMessage[];
      if (isAnthropicModel) {
        const systemMessages = coreMessages.filter(
          (msg) => msg.role === "system"
        );
        const nonSystemMessages = coreMessages.filter(
          (msg) => msg.role !== "system"
        );

        finalMessages = [
          {
            role: "system",
            content: systemPrompt,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          } as CoreMessage,
          ...systemMessages,
          ...nonSystemMessages,
        ];
      } else {
        finalMessages = coreMessages;
      }

      const streamConfig = {
        model: modelInstance,
        ...(isAnthropicModel ? {} : { system: systemPrompt }),
        messages: finalMessages,
        maxTokens: 4096,
        temperature: 0.7,
        maxSteps: MAX_STEPS,
        ...(enableTools && tools && { tools }),
        ...(abortSignal && { abortSignal }),
        ...(enableTools &&
          tools && {
            experimental_repairToolCall: async ({
              system,
              messages,
              toolCall,
              tools,
              error,
            }: {
              system: string | undefined;
              messages: CoreMessage[];
              toolCall: LanguageModelV1FunctionToolCall;
              tools: ToolSet;
              error: NoSuchToolError | InvalidToolArgumentsError;
            }): Promise<LanguageModelV1FunctionToolCall | null> => {
              // Only handle parameter validation errors, let other errors fail normally
              if (error.constructor.name !== "InvalidToolArgumentsError") {
                return null;
              }

              try {
                // Re-ask the model with error context
                const repairResult = await generateText({
                  model: modelInstance,
                  system: system || systemPrompt,
                  messages: [
                    ...messages,
                    {
                      role: "assistant" as const,
                      content: `I attempted to call the tool ${toolCall.toolName} with arguments: ${toolCall.args}`,
                    },
                    {
                      role: "user" as const,
                      content: `Error: ${error.message}\n\nPlease retry this tool call with the correct parameters.`,
                    },
                  ],
                  tools,
                });

                // Extract the first tool call that matches our tool name
                const repairedToolCall = repairResult.toolCalls?.find(
                  (tc) => tc.toolName === toolCall.toolName
                );

                if (repairedToolCall) {
                  return {
                    toolCallType: "function" as const,
                    toolCallId: toolCall.toolCallId, // Keep original ID
                    toolName: repairedToolCall.toolName,
                    args: JSON.stringify(repairedToolCall.args),
                  };
                }

                console.log(
                  `[REPAIR] No matching tool call found in repair response`
                );
                return null;
              } catch (_repairError) {
                return null;
              }
            },
          }),
      };

      // Log cache control usage for debugging
      if (isAnthropicModel) {
        console.log(
          `[LLM] Using Anthropic model ${model} with prompt caching enabled`
        );
      }

      // Pre-stream validation logs
      console.log("[DEBUG_STREAM] Model instance type:", typeof modelInstance);
      console.log(
        "[DEBUG_STREAM] Model instance keys:",
        Object.keys(modelInstance || {})
      );

      // Log API keys validation
      console.log("[DEBUG_STREAM] API keys present:", {
        anthropic: !!userApiKeys.anthropic,
        openai: !!userApiKeys.openai,
        anthropicLength: userApiKeys.anthropic?.length || 0,
      });

      // Log streamConfig validation
      console.log(
        "[DEBUG_STREAM] StreamConfig keys:",
        Object.keys(streamConfig)
      );
      console.log(
        "[DEBUG_STREAM] StreamConfig model:",
        streamConfig.model?.constructor?.name
      );
      console.log(
        "[DEBUG_STREAM] StreamConfig messages length:",
        streamConfig.messages?.length
      );
      console.log(
        "[DEBUG_STREAM] StreamConfig has tools:",
        !!streamConfig.tools
      );

      // Stream creation with error handling
      let result;
      try {
        console.log("[DEBUG_STREAM] Calling streamText with config...");
        result = streamText(streamConfig);
        console.log("[DEBUG_STREAM] streamText returned successfully");
      } catch (error) {
        console.error("[DEBUG_STREAM] streamText threw error:", error);
        console.error("[DEBUG_STREAM] Error details:", {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : "No stack trace",
        });
        throw error;
      }

      // Result object analysis
      console.log("[DEBUG_STREAM] Result object analysis:");
      console.log("[DEBUG_STREAM] Result type:", typeof result);
      console.log("[DEBUG_STREAM] Result keys:", Object.keys(result || {}));
      console.log("[DEBUG_STREAM] fullStream type:", typeof result?.fullStream);
      console.log(
        "[DEBUG_STREAM] fullStream keys:",
        result?.fullStream ? Object.keys(result.fullStream) : "N/A"
      );

      // Note: StreamTextResult doesn't have an error property
      // Errors are handled through the stream itself or thrown during creation

      const toolCallMap = new Map<string, ToolName>(); // toolCallId -> validated toolName

      // Validate fullStream exists before iteration to prevent async iterator errors
      if (!result.fullStream) {
        console.error(
          `[LLM_STREAM_ERROR] fullStream is undefined for task ${taskId}. This indicates a streaming initialization failure.`
        );
        yield {
          type: "error",
          error:
            "Stream initialization failed - unable to establish connection with LLM service",
          finishReason: "error",
        };
        return;
      }

      // Use fullStream to get real-time tool calls and results
      for await (const chunk of result.fullStream as AsyncIterable<AIStreamChunk>) {
        switch (chunk.type) {
          case "text-delta": {
            const streamChunk = this.chunkHandlers.handleTextDelta(chunk);
            if (streamChunk) {
              yield streamChunk;
            }
            break;
          }

          case "tool-call": {
            const streamChunks = this.chunkHandlers.handleToolCall(
              chunk,
              toolCallMap
            );
            for (const streamChunk of streamChunks) {
              yield streamChunk;
            }
            break;
          }

          case "tool-result": {
            const streamChunk = this.chunkHandlers.handleToolResult(
              chunk,
              toolCallMap
            );
            if (streamChunk) {
              yield streamChunk;
            }
            break;
          }

          case "finish": {
            const streamChunks = this.chunkHandlers.handleFinish(chunk, model);
            for (const streamChunk of streamChunks) {
              yield streamChunk;
            }
            break;
          }

          case "error": {
            const streamChunk = this.chunkHandlers.handleError(chunk);
            yield streamChunk;
            break;
          }
        }
      }
    } catch (error) {
      console.error("LLM Service Error:", error);
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        finishReason: "error",
      };
    }
  }
}
