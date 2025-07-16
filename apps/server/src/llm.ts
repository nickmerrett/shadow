import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { streamText, LanguageModel, CoreMessage } from 'ai';
import { StreamChunk, ModelType, getModelProvider, toCoreMessage, Message } from "@repo/types";
import config from "./config";

export class LLMService {
  private getModel(modelId: ModelType): LanguageModel {
    const provider = getModelProvider(modelId);
    
    switch (provider) {
      case 'anthropic':
        if (!config.anthropicApiKey) {
          throw new Error('Anthropic API key not configured');
        }
        return anthropic(modelId, {
          apiKey: config.anthropicApiKey,
        });
        
      case 'openai':
        if (!config.openaiApiKey) {
          throw new Error('OpenAI API key not configured');
        }
        return openai(modelId, {
          apiKey: config.openaiApiKey,
        });
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async *createMessageStream(
    systemPrompt: string,
    messages: Message[],
    model: ModelType = "claude-3-5-sonnet-20241022"
  ): AsyncGenerator<StreamChunk> {
    try {
      const modelInstance = this.getModel(model);
      
      // Convert our messages to AI SDK CoreMessage format
      const coreMessages: CoreMessage[] = messages.map(toCoreMessage);

      const result = await streamText({
        model: modelInstance,
        system: systemPrompt,
        messages: coreMessages,
        maxTokens: 4096,
        temperature: 0.7,
      });

      let hasEmittedInitialUsage = false;

      for await (const chunk of result.textStream) {
        // Emit usage info at the start if we haven't yet
        if (!hasEmittedInitialUsage && result.usage) {
          const usage = await result.usage;
          yield {
            type: "usage",
            usage: {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            },
          };
          hasEmittedInitialUsage = true;
        }

        // Emit content chunk
        yield {
          type: "content",
          content: chunk,
        };
      }

      // Wait for final results
      const finalResult = await result;
      
      // Emit final usage and completion
      yield {
        type: "usage", 
        usage: {
          promptTokens: finalResult.usage.promptTokens,
          completionTokens: finalResult.usage.completionTokens,
          totalTokens: finalResult.usage.totalTokens,
        },
      };

      yield {
        type: "complete",
        finishReason: finalResult.finishReason === 'stop' ? 'stop' :
                     finalResult.finishReason === 'length' ? 'length' :
                     finalResult.finishReason === 'content-filter' ? 'content-filter' :
                     finalResult.finishReason === 'tool-calls' ? 'tool_calls' :
                     'stop',
      };

    } catch (error) {
      console.error('LLM Service Error:', error);
      yield {
        type: "error",
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        finishReason: 'error',
      };
    }
  }

  // Helper method to get available models based on configured API keys
  getAvailableModels(): ModelType[] {
    const models: ModelType[] = [];
    
    if (config.anthropicApiKey) {
      models.push(
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-haiku-20240307"
      );
    }
    
    if (config.openaiApiKey) {
      models.push(
        "gpt-4o",
        "gpt-4o-mini", 
        "gpt-4-turbo"
      );
    }
    
    return models;
  }
}
