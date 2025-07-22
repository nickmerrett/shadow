import { getUser } from "@/lib/auth/get-user";
import { db } from "@repo/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json({ user: null });
    }

    // Gather extra stats (no IDs displayed)
    const [taskCount, completedTasks, joinedAt] = await Promise.all([
      db.task.count({ where: { userId: user.id } }),
      db.task.count({ where: { userId: user.id, status: "COMPLETED" } }),
      db.user.findUnique({
        where: { id: user.id },
        select: { createdAt: true },
      }),
    ]);

    const stats = {
      taskCount,
      completedTasks,
      pendingTasks: taskCount - completedTasks,
      joinedAt: joinedAt?.createdAt,
    };

    // Fetch GitHub integration info
    const ghAccount = await db.account.findFirst({
      where: { userId: user.id, providerId: "github" },
      select: {
        githubAppConnected: true,
        githubInstallationId: true,
      },
    });

    const github = {
      connected: !!ghAccount,
      appInstalled: ghAccount?.githubAppConnected ?? false,
    };

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        image: user.image,
      },
      stats,
      github,
    });
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
