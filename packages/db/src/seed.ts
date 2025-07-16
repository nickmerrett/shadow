import { prisma } from "./client";

async function main() {
  console.log("🌱 Seeding database...");
  console.log("Database URL:", process.env.DATABASE_URL);

  // Clear existing data in dependency order (auth tables first)
  console.log("🗑️ Clearing existing data...");
  await prisma.chatMessage.deleteMany();
  await prisma.terminalCommand.deleteMany();
  await prisma.fileChange.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.taskSession.deleteMany();
  await prisma.task.deleteMany();

  // Clear auth-related tables (updated for new schema)
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Existing data cleared");

  // Create a test user (compatible with new custom auth schema)
  const user = await prisma.user.upsert({
    where: { email: "demo@shadow.dev" },
    update: {},
    create: {
      id: "demo-user-1", // Custom ID since it's String @id
      email: "demo@shadow.dev",
      name: "Demo User",
      emailVerified: true, // Boolean field
      image: "https://github.com/github.png", // Optional GitHub avatar
      createdAt: new Date(),
      updatedAt: new Date(),
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
      description:
        "Implement user authentication with GitHub OAuth using better-auth",
      status: "COMPLETED", // Changed to completed since we just implemented it
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
        "Absolutely! I'll add Tailwind CSS for a clean, modern design. Let me update the components with beautiful styling.",
      llmModel: "claude-3-5-sonnet-20241022",
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
    {
      taskId: task1.id,
      role: "ASSISTANT" as const,
      content:
        "Perfect! I've successfully created a modern React todo app with TypeScript. The app includes all the requested functionality: add new todos, mark them as complete/incomplete, and delete them. The UI features a clean, responsive design with hover effects and a card-based layout that will look great on any device.",
      llmModel: "claude-3-5-sonnet-20241022",
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
        "I'll analyze your API performance by examining the codebase and identifying bottlenecks. Let me start by exploring the API structure.",
      llmModel: "claude-3-5-sonnet-20241022",
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
      role: "ASSISTANT" as const,
      content:
        "Excellent! The optimizations were successful. I've implemented database connection pooling, Redis caching for frequently accessed data, and eliminated N+1 query patterns. These changes should significantly improve API response times and reduce server load.",
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

  // Add some messages for task3 (better-auth implementation)
  const task3Messages = [
    {
      taskId: task3.id,
      role: "USER" as const,
      content:
        "Implement user authentication with GitHub OAuth using better-auth",
    },
    {
      taskId: task3.id,
      role: "ASSISTANT" as const,
      content:
        "I'll implement GitHub OAuth authentication using better-auth. This will provide a modern, secure authentication system with Next.js API routes.",
      llmModel: "claude-3-5-sonnet-20241022",
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Updated Prisma schema with custom auth models",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "packages/db/prisma/schema.prisma",
            content:
              "Added User, Account, Session, and Verification models with custom structure",
          },
          status: "success",
          changes: {
            linesAdded: 75,
            linesRemoved: 10,
            filePath: "packages/db/prisma/schema.prisma",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Created better-auth API route handler",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "apps/frontend/app/api/auth/[...auth]/route.ts",
            content:
              "Better-auth configuration with GitHub provider and Prisma adapter",
          },
          status: "success",
          changes: {
            linesAdded: 25,
            filePath: "apps/frontend/app/api/auth/[...auth]/route.ts",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Created auth client for frontend",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "apps/frontend/lib/auth-client.ts",
            content: "Client-side auth configuration with TypeScript types",
          },
          status: "success",
          changes: {
            linesAdded: 15,
            filePath: "apps/frontend/lib/auth-client.ts",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Implemented route protection middleware",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "apps/frontend/middleware.ts",
            content:
              "Middleware to protect routes and redirect unauthenticated users",
          },
          status: "success",
          changes: {
            linesAdded: 25,
            filePath: "apps/frontend/middleware.ts",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Created authentication page with GitHub sign-in",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "apps/frontend/app/auth/page.tsx",
            content: "Clean auth page with GitHub OAuth button",
          },
          status: "success",
          changes: {
            linesAdded: 45,
            filePath: "apps/frontend/app/auth/page.tsx",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "TOOL" as const,
      content: "Added session provider and user menu components",
      metadata: {
        tool: {
          name: "edit_file",
          args: {
            filePath: "apps/frontend/components/auth/",
            content:
              "Session context provider and user menu with logout functionality",
          },
          status: "success",
          changes: {
            linesAdded: 85,
            filePath: "apps/frontend/components/auth/",
          },
        },
      },
    },
    {
      taskId: task3.id,
      role: "ASSISTANT" as const,
      content:
        "Perfect! I've successfully implemented GitHub OAuth authentication using better-auth. The system includes secure session management, route protection, and a clean user interface. Users can now sign in with their GitHub accounts and access protected features.",
      llmModel: "claude-3-5-sonnet-20241022",
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
