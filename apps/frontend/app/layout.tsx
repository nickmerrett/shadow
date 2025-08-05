import { SessionProvider } from "@/components/auth/session-provider";
import { ModalProvider } from "@/components/layout/modal-context";
import { QueryClientProvider } from "@/components/layout/query-client-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsModal } from "@/components/auth/settings-modal";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";
import { getUser } from "@/lib/auth/get-user";
import { NextResponse } from "next/server";

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
  icons: {
    icon: [
      {
        url: "/shadow-black.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/shadow.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  // Temporary prod check
  if (process.env.VERCEL_ENV === "production") {
    const user = await getUser();
    console.log("User:", user?.email);
    if (user && user.email !== "ishaan1013@gmail.com") {
      return (
        <html>
          <body>
            <div>Unauthorized</div>
          </body>
        </html>
      );
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/DepartureMono-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
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
              <ModalProvider>
                {/* SidebarProvider also provides a TooltipProvider inside */}
                <SidebarProvider defaultOpen={defaultOpen}>
                  {/* Don't render the sidebar here; we have individual layouts for route groups to render different variants of the sidebar */}
                  {children}
                  <SettingsModal />
                  <Toaster />
                </SidebarProvider>
              </ModalProvider>
            </SessionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
