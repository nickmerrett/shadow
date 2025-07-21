import { SidebarComponent } from "@/components/sidebar";
import { getUser } from "@/lib/auth/get-user";
import { getTasks } from "@/lib/db-operations/get-tasks";
import "./globals.css";

export default async function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  const initialTasks = user ? await getTasks(user.id) : [];

  return (
    <>
      <SidebarComponent currentTaskId={null} initialTasks={initialTasks} />
      {children}
    </>
  );
}
