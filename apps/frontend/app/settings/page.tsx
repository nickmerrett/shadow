import { HomeLayoutWrapper } from "@/components/layout/home-layout";
import { getUser } from "@/lib/auth/get-user";
import { db } from "@repo/db";

export default async function SettingsPage() {
  const user = await getUser();

  // Gather extra stats (no IDs displayed)
  let stats: {
    taskCount: number;
    completedTasks: number;
    pendingTasks: number;
    joinedAt?: Date;
    emailVerified?: boolean;
  } | null = null;

  let github: { connected: boolean; appInstalled: boolean } | null = null;

  if (user?.id) {
    const [taskCount, completedTasks, joinedAt] = await Promise.all([
      db.task.count({ where: { userId: user.id } }),
      db.task.count({ where: { userId: user.id, status: "COMPLETED" } }),
      db.user.findUnique({
        where: { id: user.id },
        select: { createdAt: true },
      }),
    ]);

    stats = {
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
    github = {
      connected: !!ghAccount,
      appInstalled: ghAccount?.githubAppConnected ?? false,
    };
  }

  return (
    <HomeLayoutWrapper>
      <div className="mx-auto mt-24 flex w-full max-w-lg flex-col items-start gap-6 px-4">
        <h1 className="text-2xl font-medium">Settings</h1>
        {user ? (
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-center gap-3">
              {user.image && (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="size-10 rounded-full"
                />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground text-sm">
                  {user.email}
                </span>
              </div>
            </div>
            {stats && (
              <div className="mt-4 grid w-full grid-cols-2 gap-4 border-t pt-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Joined</span>
                  <span>{stats.joinedAt?.toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Total Tasks</span>
                  <span>{stats.taskCount}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{stats.completedTasks}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Pending</span>
                  <span>{stats.pendingTasks}</span>
                </div>
              </div>
            )}

            {github && (
              <div className="grid w-full grid-cols-2 gap-4 border-t pt-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">GitHub Linked</span>
                  <span>{github.connected ? "Yes" : "No"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">
                    GitHub App Installed
                  </span>
                  <span>{github.appInstalled ? "Yes" : "No"}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p>You are not signed in.</p>
        )}
      </div>
    </HomeLayoutWrapper>
  );
}
