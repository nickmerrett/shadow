import { initLogger, wrapAISDKModel } from "braintrust";
import { LanguageModel } from "ai";
import config from "../../../config";

export class BraintrustService {
  private logger: ReturnType<typeof initLogger> | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.isEnabled = config.enableBraintrust && !!config.braintrustApiKey;
    
    if (this.isEnabled) {
      try {
        this.logger = initLogger({
          projectName: "Shadow AI Agent",
          apiKey: config.braintrustApiKey!,
        });
        console.log("[BRAINTRUST] Observability service initialized");
      } catch (error) {
        console.error("[BRAINTRUST] Failed to initialize:", error);
        this.isEnabled = false;
      }
    } else {
      console.log("[BRAINTRUST] Observability disabled - missing API key or disabled in config");
    }
  }

  /**
   * Wrap an AI SDK model with Braintrust observability
   */
  wrapModel(model: LanguageModel, metadata?: Record<string, any>): LanguageModel {
    if (!this.isEnabled || !this.logger) {
      return model;
    }

    try {
      const wrappedModel = wrapAISDKModel(model);
      console.log("[BRAINTRUST] Model wrapped for observability", { metadata });
      return wrappedModel;
    } catch (error) {
      console.error("[BRAINTRUST] Failed to wrap model:", error);
      return model;
    }
  }

  /**
   * Get telemetry configuration for AI SDK calls
   */
  getTelemetryConfig(metadata?: Record<string, any>) {
    if (!this.isEnabled) {
      return { isEnabled: false };
    }

    return {
      isEnabled: true,
      metadata: {
        service: "shadow-agent",
        environment: config.nodeEnv,
        ...metadata,
      },
    };
  }

  /**
   * Check if Braintrust observability is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }
}

// Singleton instance
export const braintrustService = new BraintrustService();