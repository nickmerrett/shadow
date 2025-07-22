import { HomeLayoutWrapper } from "@/components/layout/home-layout";
import { getUser } from "@/lib/auth/get-user";

export default async function SettingsPage() {
  const user = await getUser();

  return (
    <HomeLayoutWrapper>
      <div className="mx-auto flex max-w-lg flex-col items-start mt-24 gap-6 w-full px-4">
        <h1 className="text-2xl font-medium">Settings</h1>
        {user ? (
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center gap-3">
              {user.image && (
                <img src={user.image} alt={user.name || "User"} className="size-10 rounded-full" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-sm text-muted-foreground">{user.email}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">User ID: {user.id}</div>
          </div>
        ) : (
          <p>You are not signed in.</p>
        )}
      </div>
    </HomeLayoutWrapper>
  );
}
