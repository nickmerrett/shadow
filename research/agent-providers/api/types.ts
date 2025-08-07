export type Role = "user" | "assistant" | "tool" | "system";

export const models = {
  claude_3_7_sonnet: {
    name: "claude-3-7-sonnet",
    isReasoning: true,
  },
  gpt_4o: {
    name: "gpt-4o",
    isReasoning: false,
  },
  gpt_4o_mini: {
    name: "gpt-4o-mini",
    isReasoning: false,
  },
};

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ChatMessage {
  role: Role;
  content: string;
  tools?: ToolCall[];
}

export interface LLM {
  name: string;
  isReasoning: boolean;
}

export interface LLMConfig {
  apiKey: string;
  model: LLM;
}
