import {
  ToolName,
  ToolResultTypes,
  ToolResultSchemas,
  ValidationErrorResult,
  createValidator,
  isTransformedMCPTool,
  getOriginalMCPToolName,
} from "@repo/types";
import { ValidationHelpers } from "./validation-helpers";

export class ToolValidator {
  private validationHelpers = new ValidationHelpers();

  /**
   * Validates a tool result and creates a graceful error result if validation fails
   */
  validateToolResult(
    toolName: ToolName | string, // Allow MCP tool names (e.g., "context7:get-library-docs")
    result: unknown
  ): {
    isValid: boolean;
    validatedResult: ToolResultTypes["result"] | ValidationErrorResult;
    shouldEmitError: boolean;
    errorDetails?: {
      error: string;
      suggestedFix: string;
      originalResult: unknown;
    };
  } {
    console.log(`[VALIDATION_DEBUG] Validating result for ${toolName}:`, {
      resultType: typeof result,
      isNull: result === null,
      isUndefined: result === undefined,
      isArray: Array.isArray(result),
      resultShape:
        result && typeof result === "object"
          ? Object.keys(result)
          : "not-object",
      resultPreview: JSON.stringify(result).substring(0, 200),
      toolNameFormat: toolName.includes(':') ? 'original_colon' : toolName.includes('_') ? 'transformed_underscore' : 'native'
    });

    try {
      // Check if this is an MCP tool (either original format with colon or transformed format)
      if (typeof toolName === 'string') {
        // Check original MCP format (server:tool)
        if (toolName.includes(':')) {
          console.log(`[VALIDATION_DEBUG] Skipping validation for original MCP tool: ${toolName}`);
          return {
            isValid: true,
            validatedResult: result as ToolResultTypes["result"],
            shouldEmitError: false,
          };
        }
        
        // Check transformed MCP format (server_tool)
        if (isTransformedMCPTool(toolName)) {
          const originalName = getOriginalMCPToolName(toolName);
          console.log(`[VALIDATION_DEBUG] Skipping validation for transformed MCP tool: ${toolName} (original: ${originalName})`);
          return {
            isValid: true,
            validatedResult: result as ToolResultTypes["result"],
            shouldEmitError: false,
          };
        }
      }

      // Check if this looks like an MCP tool name but wasn't recognized
      if (typeof toolName === 'string' && (toolName.includes('_') && /^[a-zA-Z0-9]+[_][a-zA-Z0-9_-]+$/.test(toolName))) {
        console.log(`🚨 [MCP_VALIDATION_ERROR] Unknown MCP tool called: ${toolName}`);
        console.log(`❌ [MCP_DEBUG] This looks like an MCP tool but wasn't found in our registry`);
      }

      // toolName is guaranteed to be valid for native tools, validate the result directly
      const schema = ToolResultSchemas[toolName as ToolName];
      console.log(`[VALIDATION_DEBUG] Using schema for ${toolName}:`, {
        schemaExists: !!schema,
        schemaType: schema?._def?.typeName,
      });

      const validation = createValidator(schema)(result);

      if (validation.success) {
        console.log(`[VALIDATION_DEBUG] Validation succeeded for ${toolName}`);
        return {
          isValid: true,
          validatedResult: validation.data!,
          shouldEmitError: false,
        };
      }

      console.log(`[VALIDATION_DEBUG] Validation failed for ${toolName}:`, {
        validationError: validation.error,
        validationSuccess: validation.success,
      });

      // Generate helpful error message for the LLM
      const errorMessage = `Tool call validation failed for ${toolName}: ${validation.error}`;
      const suggestedFix =
        this.validationHelpers.generateToolValidationSuggestion(
          toolName,
          validation.error || ""
        );

      const errorResult: ValidationErrorResult = {
        success: false,
        error: errorMessage,
        suggestedFix,
        originalResult: result,
        validationDetails: {
          expectedType: "Valid tool result schema",
          receivedType: typeof result,
          fieldPath: validation.error || "",
        },
      };

      return {
        isValid: false,
        validatedResult: errorResult,
        shouldEmitError: true,
        errorDetails: {
          error: errorMessage,
          suggestedFix,
          originalResult: result,
        },
      };
    } catch (error) {
      // Fallback for unexpected validation errors
      const fallbackMessage = `Unexpected validation error for tool ${toolName}: ${error instanceof Error ? error.message : "Unknown error"}`;

      return {
        isValid: false,
        validatedResult: {
          success: false,
          error: fallbackMessage,
          suggestedFix:
            "Please retry the tool call with valid parameters according to the tool schema.",
          originalResult: result,
        } as ValidationErrorResult,
        shouldEmitError: true,
        errorDetails: {
          error: fallbackMessage,
          suggestedFix:
            "Please retry the tool call with valid parameters according to the tool schema.",
          originalResult: result,
        },
      };
    }
  }
}
