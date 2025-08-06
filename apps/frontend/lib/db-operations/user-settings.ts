import { prisma } from "@repo/db";

export interface UserSettings {
  id: string;
  userId: string;
  autoPullRequest: boolean;
  enableDeepWiki: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  return settings;
}

export async function createUserSettings(
  userId: string,
  settings: { autoPullRequest: boolean; enableDeepWiki?: boolean }
): Promise<UserSettings> {
  return await prisma.userSettings.create({
    data: {
      userId,
      autoPullRequest: settings.autoPullRequest,
      enableDeepWiki: settings.enableDeepWiki ?? true, // Default to true
    },
  });
}

export async function updateUserSettings(
  userId: string,
  settings: { autoPullRequest?: boolean; enableDeepWiki?: boolean }
): Promise<UserSettings> {
  const updateData: { autoPullRequest?: boolean; enableDeepWiki?: boolean } =
    {};
  if (settings.autoPullRequest !== undefined)
    updateData.autoPullRequest = settings.autoPullRequest;
  if (settings.enableDeepWiki !== undefined)
    updateData.enableDeepWiki = settings.enableDeepWiki;

  return await prisma.userSettings.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      autoPullRequest: settings.autoPullRequest ?? false, // Default to false for autoPR
      enableDeepWiki: settings.enableDeepWiki ?? true, // Default to true for deepWiki
    },
  });
}

export async function getOrCreateUserSettings(
  userId: string
): Promise<UserSettings> {
  let settings = await getUserSettings(userId);

  if (!settings) {
    settings = await createUserSettings(userId, {
      autoPullRequest: false, // Default to false for autoPR
      enableDeepWiki: true, // Default to true for deepWiki
    });
  }

  return settings;
}
