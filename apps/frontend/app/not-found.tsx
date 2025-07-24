import Link from "next/link";
import { SidebarViews } from "@/components/sidebar";
import { getUser } from "@/lib/auth/get-user";
import { getTasks } from "@/lib/db-operations/get-tasks";
import { LogoHover } from "@/components/logo/logo-hover";

export default async function NotFound() {
  const user = await getUser();
  const initialTasks = user ? await getTasks(user.id) : [];

  return (
    <>
      {/* Render the sidebar */}
      <SidebarViews initialTasks={initialTasks} currentTask={null} />

      {/* Fallback content */}
      <div className="flex flex-col grow items-center justify-center gap-6 p-6">
        <div className="flex items-center gap-4">
          <LogoHover size="lg" forceAnimate />
          <h2 className="text-4xl font-bold font-departureMono">Not Found</h2>
        </div>
        <p className="text-lg font-departureMono">
          We couldn't find the page you were looking for.
        </p>
        <Link
          href="/"
          className="text-lg text-blue-500/50 font-departureMono hover:text-blue-500 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </>
  );
}