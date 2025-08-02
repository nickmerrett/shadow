import type { MessageMetadata } from "../chat/messages";
import type {
  ToolName,
  FileSearchResult,
} from "./schemas";
import { ToolResultSchemas } from "./schemas";
import { z } from "zod";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): ValidationResult<T> => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errorMessage = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return { success: false, error: errorMessage };
    }
  };
}

// Type-safe accessor for tool results with Zod validation
export function getToolResult<T extends ToolName>(
  toolMeta: MessageMetadata["tool"] | undefined,
  toolName: T
): any {
  if (!toolMeta?.result || toolMeta.name !== toolName) return null;

  try {
    // Handle both new object format and legacy JSON strings
    const rawResult =
      typeof toolMeta.result === "string"
        ? JSON.parse(toolMeta.result)
        : toolMeta.result;

    // Get the appropriate schema for validation
    const schema = ToolResultSchemas[toolName];
    if (!schema) {
      console.warn(`No schema found for tool: ${toolName}`);
      return rawResult;
    }

    // Validate the result using Zod
    const validation = createValidator(schema)(rawResult);
    if (validation.success) {
      return validation.data;
    } else {
      console.warn(
        `Tool result validation failed for ${toolName}:`,
        validation.error
      );
      // Return raw result for backward compatibility, but log the validation error
      return rawResult;
    }
  } catch (error) {
    console.warn(`Failed to parse tool result for ${toolName}:`, error);
    return null;
  }
}

export function validateToolResult<T extends ToolName>(
  result: unknown,
  toolName: T
): ValidationResult<any> {
  const schema = ToolResultSchemas[toolName];
  if (!schema) {
    return { success: false, error: `No schema found for tool: ${toolName}` };
  }

  return createValidator(schema)(result);
}

// Only keep the type guards that are actually used in the codebase
export function isFileSearchResult(
  result: unknown
): result is FileSearchResult {
  const validation = validateToolResult(result, "file_search");
  return validation.success;
}
