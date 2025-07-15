export type BaseMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  createdAt: string;
  metadata: Record<string, any> | null;
};

export type UserMessage = BaseMessage & {
  role: "USER";
  content: string;
  metadata: null;
};

export type AssistantMessage = BaseMessage & {
  role: "ASSISTANT";
  content: string;
  metadata: {
    type: "thinking";
    content: string;
    duration: number; // seconds
  } | null;
};

export type ToolMessage = BaseMessage & {
  role: "TOOL";
  content: string;
  metadata: {
    tool: string;
    args: Record<string, any>;
    status: "running" | "success" | "error";
    result?: string;
    error?: string;
    changes?: {
      linesAdded?: number;
      linesRemoved?: number;
      filePath?: string;
    };
  };
};

export const EXAMPLE_CHAT_HISTORY: (
  | AssistantMessage
  | ToolMessage
  | UserMessage
)[] = [
  {
    id: "msg_user_001",
    role: "USER",
    content: "Add error handling to the login function in auth.ts",
    createdAt: "2024-01-15T10:30:00Z",
    metadata: null,
  },
  {
    id: "msg_assistant_001",
    role: "ASSISTANT",
    content: "",
    createdAt: "2024-01-15T10:30:02Z",
    metadata: {
      type: "thinking",
      content:
        "I need to examine the current login function to understand its structure and identify where error handling should be added. Let me first read the auth.ts file to see what we're working with.",
      duration: 3,
    },
  },
  {
    id: "msg_assistant_002",
    role: "ASSISTANT",
    content:
      "I'll help you add proper error handling to the login function. Let me first examine the current implementation.",
    createdAt: "2024-01-15T10:30:03Z",
    metadata: null,
  },
  {
    id: "msg_tool_001",
    role: "TOOL",
    content: "read_file",
    createdAt: "2024-01-15T10:30:04Z",
    metadata: {
      tool: "read_file",
      args: {
        target_file: "src/auth.ts",
        start_line_one_indexed: 1,
        end_line_one_indexed: 50,
      },
      status: "success",
      result:
        "```typescript\nexport async function login(email: string, password: string) {\n  const user = await db.user.findUnique({ where: { email } });\n  const isValid = await bcrypt.compare(password, user.passwordHash);\n  if (isValid) {\n    return generateJWT(user.id);\n  }\n  return null;\n}\n```",
    },
  },
  {
    id: "msg_assistant_003",
    role: "ASSISTANT",
    content: "",
    createdAt: "2024-01-15T10:30:06Z",
    metadata: {
      type: "thinking",
      content:
        "I can see several issues with this login function: 1) No error handling for database queries, 2) Will throw if user is null when accessing passwordHash, 3) No validation for input parameters, 4) No proper error types/messages. I should add try-catch blocks and proper validation.",
      duration: 2,
    },
  },
  {
    id: "msg_assistant_004",
    role: "ASSISTANT",
    content:
      "I can see the current login function lacks proper error handling. It will crash if the user doesn't exist or if the database query fails. Let me add comprehensive error handling:",
    createdAt: "2024-01-15T10:30:07Z",
    metadata: null,
  },
  {
    id: "msg_tool_002",
    role: "TOOL",
    content: "edit_file",
    createdAt: "2024-01-15T10:30:08Z",
    metadata: {
      tool: "edit_file",
      args: {
        target_file: "src/auth.ts",
        instructions:
          "Adding comprehensive error handling with try-catch blocks, input validation, and proper error types",
        code_edit:
          "export async function login(email: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {\n  try {\n    // Input validation\n    if (!email || !password) {\n      return { success: false, error: 'Email and password are required' };\n    }\n\n    // Database query with error handling\n    const user = await db.user.findUnique({ where: { email } });\n    \n    if (!user) {\n      return { success: false, error: 'Invalid credentials' };\n    }\n\n    // Password comparison with error handling\n    const isValid = await bcrypt.compare(password, user.passwordHash);\n    \n    if (!isValid) {\n      return { success: false, error: 'Invalid credentials' };\n    }\n\n    // Generate JWT with error handling\n    const token = await generateJWT(user.id);\n    return { success: true, token };\n    \n  } catch (error) {\n    console.error('Login error:', error);\n    return { success: false, error: 'An unexpected error occurred during login' };\n  }\n}",
      },
      status: "success",
      result: "✅ Successfully updated src/auth.ts",
      changes: {
        linesAdded: 15,
        linesRemoved: 7,
        filePath: "src/auth.ts",
      },
    },
  },
  {
    id: "msg_assistant_005",
    role: "ASSISTANT",
    content:
      "Perfect! I've added comprehensive error handling to your login function. The new implementation includes input validation, proper error messages, database error handling, and returns a structured response object instead of potentially throwing errors.",
    createdAt: "2024-01-15T10:30:11Z",
    metadata: null,
  },
];
