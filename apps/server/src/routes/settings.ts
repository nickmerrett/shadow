import { Router } from "express";
import { z } from "zod";
import { prisma } from "@repo/db";

export const settingsRouter = Router();

const updateUserSettingsSchema = z.object({
  memoriesEnabled: z.boolean().optional(),
});

// Get user settings
settingsRouter.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get or create user settings
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!userSettings) {
      // Create default settings if they don't exist
      userSettings = await prisma.userSettings.create({
        data: {
          userId,
          memoriesEnabled: false, // Default disabled
        },
      });
    }

    res.json({
      success: true,
      settings: {
        memoriesEnabled: userSettings.memoriesEnabled,
      },
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ error: "Failed to fetch user settings" });
  }
});

// Update user settings
settingsRouter.patch("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const validation = updateUserSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const updateData = validation.data;

    // Update or create user settings
    const userSettings = await prisma.userSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        memoriesEnabled: updateData.memoriesEnabled ?? false,
      },
    });

    res.json({
      success: true,
      settings: {
        memoriesEnabled: userSettings.memoriesEnabled,
      },
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

// Get memories for user (repository-specific and global)
settingsRouter.get("/:userId/memories", async (req, res) => {
  try {
    const { userId } = req.params;
    const { repoFullName, category } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Check if user has memories enabled
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!userSettings?.memoriesEnabled) {
      return res.json({
        success: false,
        error: "Memories are disabled",
        memories: [],
      });
    }

    // Build filter conditions
    const whereConditions: any = {
      userId,
    };

    if (repoFullName) {
      whereConditions.OR = [
        { isGlobal: true },
        { 
          AND: [
            { isGlobal: false },
            { repoFullName: repoFullName as string },
          ],
        },
      ];
    }

    if (category) {
      whereConditions.category = category as string;
    }

    const memories = await prisma.memory.findMany({
      where: whereConditions,
      orderBy: [
        { category: "asc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        content: true,
        category: true,
        isGlobal: true,
        repoFullName: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      memories,
      totalCount: memories.length,
      globalCount: memories.filter((m) => m.isGlobal).length,
      repoCount: memories.filter((m) => !m.isGlobal).length,
    });
  } catch (error) {
    console.error("Error fetching memories:", error);
    res.status(500).json({ error: "Failed to fetch memories" });
  }
});

// Delete memory
settingsRouter.delete("/:userId/memories/:memoryId", async (req, res) => {
  try {
    const { userId, memoryId } = req.params;

    if (!userId || !memoryId) {
      return res.status(400).json({ error: "User ID and Memory ID are required" });
    }

    // Verify memory belongs to user
    const memory = await prisma.memory.findFirst({
      where: {
        id: memoryId,
        userId,
      },
    });

    if (!memory) {
      return res.status(404).json({ error: "Memory not found or access denied" });
    }

    await prisma.memory.delete({
      where: { id: memoryId },
    });

    res.json({
      success: true,
      message: "Memory deleted successfully",
      deletedMemory: {
        id: memory.id,
        content: memory.content,
        category: memory.category,
        isGlobal: memory.isGlobal,
      },
    });
  } catch (error) {
    console.error("Error deleting memory:", error);
    res.status(500).json({ error: "Failed to delete memory" });
  }
});