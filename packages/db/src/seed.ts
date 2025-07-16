import { prisma } from "./client";

async function main() {
  console.log("🌱 Seeding database...");
  console.log("Database URL:", process.env.DATABASE_URL);

  // Clear existing data in dependency order
  console.log("🗑️ Clearing existing data...");
  await prisma.chatMessage.deleteMany();
  await prisma.terminalCommand.deleteMany();
  await prisma.fileChange.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.taskSession.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Existing data cleared");

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: "demo@shadow.dev" },
    update: {},
    create: {
      email: "demo@shadow.dev",
      name: "Demo User",
    },
  });

  console.log("Created user:", user.id);

  // Create some demo tasks
  const task1 = await prisma.task.upsert({
    where: { id: "demo-task-1" },
    update: {},
    create: {
      id: "demo-task-1",
      title: "Build a React todo app",
      description: "Create a simple todo application with React and TypeScript",
      status: "RUNNING",
      repoUrl: "https://github.com/ishaan1013/shadow",
      branch: "main",
      mode: "FULL_AUTO",
      userId: user.id,
    },
  });

  const task2 = await prisma.task.upsert({
    where: { id: "demo-task-2" },
    update: {},
    create: {
      id: "demo-task-2",
      title: "Optimize API performance",
      description: "Improve the performance of our REST API endpoints",
      status: "COMPLETED",
      repoUrl: "https://github.com/ishaan1013/shadow",
      branch: "main",
      mode: "INTELLIGENT_AUTO",
      userId: user.id,
    },
  });

  const task3 = await prisma.task.upsert({
    where: { id: "demo-task-3" },
    update: {},
    create: {
      id: "demo-task-3",
      title: "Add authentication system",
      description: "Implement user authentication with JWT tokens",
      status: "PENDING",
      repoUrl: "https://github.com/ishaan1013/shadow",
      branch: "feature/auth",
      mode: "MANUAL",
      userId: user.id,
    },
  });

  console.log("Created tasks:", [task1.id, task2.id, task3.id]);

  // Add some sample chat messages for task1
  const messages = [
    {
      taskId: task1.id,
      role: "USER" as const,
      content:
        "Create a simple todo app with React and TypeScript. Make it look modern and include add, delete, and toggle complete functionality.",
    },
    {
      taskId: task1.id,
      role: "ASSISTANT" as const,
      content:
        "I'll help you create a modern React todo app with TypeScript. Let me start by exploring the project structure and then create the necessary components.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content:
        "Listed 8 items in src/ directory including components/, types/, and App.tsx",
      metadata: {
        tool: {
          name: "list_directory",
          args: { path: "src/" },
          status: "success",
          result:
            "components/\ntypes/\nApp.tsx\nindex.tsx\nindex.css\nutils/\nhooks/\nstyles/",
        },
      },
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content: "Reading App.tsx to understand current structure",
      metadata: {
        tool: {
          name: "read_file",
          args: { filePath: "src/App.tsx" },
          status: "success",
          result: "Basic React app boilerplate with TypeScript",
        },
      },
    },
    {
      taskId: task1.id,
      role: "ASSISTANT" as const,
      content:
        "Perfect! I can see the project structure. Now I'll create a Todo component with TypeScript interfaces and modern styling. Let me start by creating the types and main Todo component.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content:
        "Created new file with Todo interface and TodoItem type definitions",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/types/todo.ts",
            content:
              "export interface Todo { id: string; text: string; completed: boolean; createdAt: Date; }",
          },
          status: "success",
          changes: {
            linesAdded: 5,
            filePath: "src/types/todo.ts",
          },
        },
      },
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content:
        "Created TodoApp component with add, delete, and toggle functionality",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/components/TodoApp.tsx",
            content: "Modern React component with hooks for state management",
          },
          status: "success",
          changes: {
            linesAdded: 85,
            filePath: "src/components/TodoApp.tsx",
          },
        },
      },
    },
    {
      taskId: task1.id,
      role: "USER" as const,
      content: "Great! Can you also add some nice styling with Tailwind CSS?",
    },
    {
      taskId: task1.id,
      role: "ASSISTANT" as const,
      content:
        "Absolutely! I'll add Tailwind CSS for a clean, modern design. Let me install it and update the components with beautiful styling.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content: "Installing Tailwind CSS and its dependencies",
      metadata: {
        tool: {
          name: "run_terminal",
          args: { command: "npm install -D tailwindcss postcss autoprefixer" },
          status: "success",
          result: "Successfully installed Tailwind CSS packages",
        },
      },
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content: "Initializing Tailwind configuration",
      metadata: {
        tool: {
          name: "run_terminal",
          args: { command: "npx tailwindcss init -p" },
          status: "success",
          result: "Created tailwind.config.js and postcss.config.js",
        },
      },
    },
    {
      taskId: task1.id,
      role: "TOOL" as const,
      content:
        "Updated TodoApp component with Tailwind CSS classes for modern styling",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/components/TodoApp.tsx",
            content:
              "Added responsive design, hover effects, and clean card-based layout",
          },
          status: "success",
          changes: {
            linesAdded: 15,
            linesRemoved: 8,
            filePath: "src/components/TodoApp.tsx",
          },
        },
      },
    },
  ];

  for (const msg of messages) {
    await prisma.chatMessage.create({
      data: msg,
    });
  }

  console.log(
    `Created ${messages.length} sample messages for task ${task1.id}`
  );

  // Add some messages for task2
  const task2Messages = [
    {
      taskId: task2.id,
      role: "USER" as const,
      content: "Can you analyze our API performance and suggest optimizations?",
    },
    {
      taskId: task2.id,
      role: "ASSISTANT" as const,
      content:
        "I'll analyze your API performance by examining the codebase, running benchmarks, and identifying bottlenecks. Let me start by exploring the API structure.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Searching for API route definitions and database queries",
      metadata: {
        tool: {
          name: "codebase_search",
          args: {
            query: "API routes endpoints database queries",
            directories: ["src/api", "src/routes"],
          },
          status: "success",
          result: "Found 12 API endpoints with various database query patterns",
        },
      },
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Analyzing main API server file for performance patterns",
      metadata: {
        tool: {
          name: "read_file",
          args: { filePath: "src/api/server.ts" },
          status: "success",
          result: "Express server with multiple middleware and route handlers",
        },
      },
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Running performance benchmark to establish baseline",
      metadata: {
        tool: {
          name: "run_terminal",
          args: {
            command:
              "npm run benchmark -- --endpoint=/api/users --requests=1000",
          },
          status: "success",
          result: "Average response time: 450ms, 95th percentile: 1.2s",
        },
      },
    },
    {
      taskId: task2.id,
      role: "ASSISTANT" as const,
      content:
        "Based on my analysis, I found several performance bottlenecks. Let me implement the optimizations:",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Added database connection pooling configuration",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/config/database.ts",
            content:
              "Updated with connection pooling settings and query optimization",
          },
          status: "success",
          changes: {
            linesAdded: 12,
            linesRemoved: 3,
            filePath: "src/config/database.ts",
          },
        },
      },
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Implemented Redis caching for frequently accessed data",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/middleware/cache.ts",
            content: "Added Redis caching middleware with TTL configuration",
          },
          status: "success",
          changes: {
            linesAdded: 35,
            filePath: "src/middleware/cache.ts",
          },
        },
      },
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Optimized N+1 queries in user endpoints",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/api/users.ts",
            content:
              "Replaced individual queries with batch operations and joins",
          },
          status: "success",
          changes: {
            linesAdded: 8,
            linesRemoved: 15,
            filePath: "src/api/users.ts",
          },
        },
      },
    },
    {
      taskId: task2.id,
      role: "TOOL" as const,
      content: "Running post-optimization benchmark",
      metadata: {
        tool: {
          name: "run_terminal",
          args: {
            command:
              "npm run benchmark -- --endpoint=/api/users --requests=1000",
          },
          status: "success",
          result: "Average response time: 180ms, 95th percentile: 420ms",
        },
      },
    },
    {
      taskId: task2.id,
      role: "ASSISTANT" as const,
      content:
        "Excellent! The optimizations were successful. I've achieved a 60% reduction in average response times (450ms → 180ms) and a 65% improvement in 95th percentile latency. The main improvements came from database connection pooling, Redis caching for hot data, and eliminating N+1 query patterns.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
  ];

  for (const msg of task2Messages) {
    await prisma.chatMessage.create({
      data: msg,
    });
  }

  console.log(
    `Created ${task2Messages.length} sample messages for task ${task2.id}`
  );

  // Add some messages for task3 (auth system)
  const task3Messages = [
    {
      taskId: task3.id,
      role: "USER" as const,
      content: "Implement user authentication with JWT tokens",
    },
    {
      taskId: task3.id,
      role: "ASSISTANT" as const,
      content:
        "I'll implement a secure JWT authentication system. Let me start by examining the current project structure and installing the necessary dependencies.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Searching for existing authentication code",
      metadata: {
        tool: {
          name: "grep_search",
          args: { pattern: "auth|jwt|login|password", include: "*.ts,*.js" },
          status: "success",
          result: "No existing authentication implementation found",
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Installing JWT and bcrypt dependencies",
      metadata: {
        tool: {
          name: "run_terminal",
          args: {
            command:
              "npm install jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt",
          },
          status: "success",
          result: "Successfully installed authentication packages",
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Creating user authentication middleware",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/middleware/auth.ts",
            content: "JWT verification middleware with error handling",
          },
          status: "success",
          changes: {
            linesAdded: 42,
            filePath: "src/middleware/auth.ts",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Attempt to create auth routes",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/routes/auth.ts",
            content: "Login and register endpoints with JWT token generation",
          },
          status: "error",
          error: "File already exists and has conflicting content",
        },
      },
    },
    {
      taskId: task3.id,
      role: "ASSISTANT" as const,
      content:
        "I see there's already an auth routes file. Let me check its current content and merge my changes appropriately.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Reading existing auth routes file",
      metadata: {
        tool: {
          name: "read_file",
          args: { filePath: "src/routes/auth.ts", startLine: 1, endLine: 50 },
          status: "success",
          result: "Basic auth routes with placeholder implementations",
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Updated auth routes with JWT implementation",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "src/routes/auth.ts",
            content:
              "Enhanced with JWT token generation and bcrypt password hashing",
          },
          status: "success",
          changes: {
            linesAdded: 35,
            linesRemoved: 8,
            filePath: "src/routes/auth.ts",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Running tests to verify authentication flow",
      metadata: {
        tool: {
          name: "run_terminal",
          args: { command: "npm test -- auth.test.js" },
          status: "success",
          result: "All 8 authentication tests passed",
        },
      },
    },
  ];

  for (const msg of task3Messages) {
    await prisma.chatMessage.create({
      data: msg,
    });
  }

  console.log(
    `Created ${task3Messages.length} sample messages for task ${task3.id}`
  );

  console.log("🌱 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
