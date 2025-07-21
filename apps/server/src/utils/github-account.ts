import { prisma } from "@repo/db";

export async function getGitHubAccount(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "github",
    },
  });

  return account;
}

export async function getGitHubAccessToken(
  userId: string
): Promise<string | null> {
  const account = await getGitHubAccount(userId);
  return account?.accessToken || null;
}
