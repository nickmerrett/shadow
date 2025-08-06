import { ApiKeys, ModelType } from "@repo/types";
import { getModelProvider, getMiniModelForProvider } from "@repo/types";

/**
 * Task-scoped context that encapsulates model selection and API key management.
 */
export class TaskModelContext {
  constructor(
    private taskId: string,
    private mainModel: ModelType,
    private apiKeys: ApiKeys,
    private selectedMiniModels?: Record<string, ModelType>
  ) {}

  getMainModel(): ModelType {
    return this.mainModel;
  }

  getMiniModel(): ModelType {
    return getMiniModelForProvider(this.mainModel, this.selectedMiniModels);
  }

  getProviderApiKey(): string | undefined {
    const provider = getModelProvider(this.mainModel);
    return this.apiKeys[provider];
  }

  getApiKeys(): ApiKeys {
    return this.apiKeys;
  }

  getProvider(): "anthropic" | "openai" | "openrouter" /* | "ollama" */ {
    return getModelProvider(this.mainModel);
  }

  getModelForOperation(operation: "main" | "commit-msg" | "pr-gen"): ModelType {
    switch (operation) {
      case "main":
        return this.getMainModel();
      case "commit-msg":
      case "pr-gen":
        return this.getMiniModel();
      default:
        return this.getMainModel();
    }
  }

  getApiKeyForOperation(
    operation: "main" | "commit-msg" | "pr-gen"
  ): string | undefined {
    const model = this.getModelForOperation(operation);
    const provider = getModelProvider(model);
    return this.apiKeys[provider];
  }

  validateAccess(): boolean {
    const apiKey = this.getProviderApiKey();
    return !!apiKey;
  }

  validateOperationAccess(
    operation: "main" | "commit-msg" | "pr-gen"
  ): boolean {
    const apiKey = this.getApiKeyForOperation(operation);
    return !!apiKey;
  }

  getTaskId(): string {
    return this.taskId;
  }
}
