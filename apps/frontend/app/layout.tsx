import { SessionProvider } from "@/components/auth/session-provider";
import { AgentEnvironmentProvider } from "@/components/layout/agent-environment-provider";
import { AgentEnvironmentToggle } from "@/components/layout/agent-environment-toggle";
import { QueryClientProvider } from "@/components/layout/query-client-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SidebarComponent } from "@/components/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getUser } from "@/lib/auth/get-user";
import { getTasks } from "@/lib/db-operations/get-tasks";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shadow",
  description:
    "A remote, autonomous coding agent for complex and long-running tasks.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const user = await getUser();

  if (!user) {
    redirect("/auth");
  }

  const initialTasks = await getTasks(user.id);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} overscroll-none antialiased`}
      >
        <QueryClientProvider>
          <ThemeProvider
            attribute="class"
            forcedTheme="dark"
            disableTransitionOnChange
          >
            <SessionProvider>
              <AgentEnvironmentProvider>
                <SidebarProvider defaultOpen={defaultOpen}>
                  <SidebarComponent initialTasks={initialTasks} />
                  <div className="flex size-full min-h-svh flex-col relative">
                    <div className="flex w-full items-center justify-between p-3 sticky top-0 bg-background z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarTrigger />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Toggle Sidebar
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AgentEnvironmentToggle />
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            Toggle Agent Environment
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {children}
                  </div>
                  <Toaster />
                </SidebarProvider>
              </AgentEnvironmentProvider>
            </SessionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
