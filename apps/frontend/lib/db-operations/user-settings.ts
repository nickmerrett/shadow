import { prisma } from "@repo/db";
import { ModelType } from "@repo/types";

export interface UserSettings {
  id: string;
  userId: string;
  autoPullRequest: boolean;
  enableDeepWiki: boolean;
  memoriesEnabled: boolean;
  selectedModels: string[];
  selectedMiniModels: Record<string, ModelType>;
  createdAt: Date;
  updatedAt: Date;
}

export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (settings) {
    return {
      ...settings,
      selectedMiniModels: settings.selectedMiniModels as Record<
        string,
        ModelType
      >,
    };
  }

  return settings;
}

export async function createUserSettings(
  userId: string,
  settings: {
    autoPullRequest: boolean;
    enableDeepWiki?: boolean;
    memoriesEnabled?: boolean;
    selectedModels?: string[];
    selectedMiniModels?: Record<string, ModelType>;
  }
): Promise<UserSettings> {
  const result = await prisma.userSettings.create({
    data: {
      userId,
      autoPullRequest: settings.autoPullRequest,
      enableDeepWiki: settings.enableDeepWiki ?? true,
      memoriesEnabled: settings.memoriesEnabled ?? true,
      selectedModels: settings.selectedModels ?? [],
      selectedMiniModels: settings.selectedMiniModels ?? {},
    },
  });

  return {
    ...result,
    selectedMiniModels: result.selectedMiniModels as Record<string, ModelType>,
  };
}

export async function updateUserSettings(
  userId: string,
  settings: {
    autoPullRequest?: boolean;
    enableDeepWiki?: boolean;
    memoriesEnabled?: boolean;
    selectedModels?: string[];
    selectedMiniModels?: Record<string, ModelType>;
  }
): Promise<UserSettings> {
  try {
    const updateData: {
      autoPullRequest?: boolean;
      enableDeepWiki?: boolean;
      memoriesEnabled?: boolean;
      selectedModels?: string[];
      selectedMiniModels?: Record<string, ModelType>;
    } = {};

    if (settings.autoPullRequest !== undefined)
      updateData.autoPullRequest = settings.autoPullRequest;
    if (settings.enableDeepWiki !== undefined)
      updateData.enableDeepWiki = settings.enableDeepWiki;
    if (settings.memoriesEnabled !== undefined)
      updateData.memoriesEnabled = settings.memoriesEnabled;
    if (settings.selectedModels !== undefined)
      updateData.selectedModels = settings.selectedModels;
    if (settings.selectedMiniModels !== undefined)
      updateData.selectedMiniModels = settings.selectedMiniModels;

    // Build create data object with only non-default values
    const createData: {
      userId: string;
      autoPullRequest?: boolean;
      enableDeepWiki?: boolean;
      memoriesEnabled?: boolean;
      selectedModels?: string[];
      selectedMiniModels?: any; // Use any for JSON field
    } = {
      userId,
    };

    if (
      settings.autoPullRequest !== undefined &&
      settings.autoPullRequest !== false
    )
      createData.autoPullRequest = settings.autoPullRequest;
    if (
      settings.enableDeepWiki !== undefined &&
      settings.enableDeepWiki !== true
    )
      createData.enableDeepWiki = settings.enableDeepWiki;
    if (
      settings.memoriesEnabled !== undefined &&
      settings.memoriesEnabled !== true
    )
      createData.memoriesEnabled = settings.memoriesEnabled;
    if (
      settings.selectedModels !== undefined &&
      settings.selectedModels.length > 0
    )
      createData.selectedModels = settings.selectedModels;
    if (
      settings.selectedMiniModels !== undefined &&
      Object.keys(settings.selectedMiniModels).length > 0
    )
      createData.selectedMiniModels = settings.selectedMiniModels;

    const result = await prisma.userSettings.upsert({
      where: { userId },
      update: updateData,
      create: createData,
    });

    return {
      ...result,
      selectedMiniModels: result.selectedMiniModels as Record<
        string,
        ModelType
      >,
    };
  } catch (error) {
    console.error("Error in updateUserSettings:", error);
    throw error;
  }
}

export async function getOrCreateUserSettings(
  userId: string
): Promise<UserSettings> {
  let settings = await getUserSettings(userId);

  if (!settings) {
    settings = await createUserSettings(userId, {
      autoPullRequest: false,
      enableDeepWiki: true,
      memoriesEnabled: true,
      selectedModels: [],
      selectedMiniModels: {},
    });
  }

  return settings;
}
