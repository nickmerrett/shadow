import { prisma } from "./client";

async function main() {
  console.log("🌱 Seeding database...");
  console.log("Database URL:", process.env.DATABASE_URL);

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
      llmModel: "claude-3-5-sonnet-20241022",
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
      llmModel: "claude-3-5-sonnet-20241022",
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
      llmModel: "claude-3-5-sonnet-20241022",
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
      content: "Create a simple todo app with React and TypeScript. Make it look modern and include add, delete, and toggle complete functionality.",
    },
    {
      taskId: task1.id,
      role: "ASSISTANT" as const,
      content: "I'll help you create a modern React todo app with TypeScript. Let me start by setting up the basic structure with components for the todo list, individual todo items, and an input form for adding new todos.",
    },
    {
      taskId: task1.id,
      role: "USER" as const,
      content: "Great! Can you also add some nice styling with Tailwind CSS?",
    },
    {
      taskId: task1.id,
      role: "ASSISTANT" as const,
      content: "Absolutely! I'll use Tailwind CSS to create a clean, modern design with proper spacing, colors, and hover effects. The app will have a centered layout with a card-based design for the todo items.",
    },
  ];

  for (const msg of messages) {
    await prisma.chatMessage.create({
      data: msg,
    });
  }

  console.log(`Created ${messages.length} sample messages for task ${task1.id}`);

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
      content: "I've analyzed your API endpoints and identified several optimization opportunities: database query optimization, caching strategies, response compression, and connection pooling. The changes resulted in a 60% reduction in average response times.",
    },
  ];

  for (const msg of task2Messages) {
    await prisma.chatMessage.create({
      data: msg,
    });
  }

  console.log(`Created ${task2Messages.length} sample messages for task ${task2.id}`);

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
