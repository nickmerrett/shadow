import { SessionProvider } from "@/components/auth/session-provider";
import { ModalProvider } from "@/components/layout/modal-context";
import { QueryClientProvider } from "@/components/layout/query-client-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsModal } from "@/components/auth/settings-modal";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";
import { getUser } from "@/lib/auth/get-user";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const departureMono = localFont({
  src: "./fonts/DepartureMono-Regular.woff2",
  variable: "--font-departure-mono",
});

export const metadata: Metadata = {
  title: "Shadow",
  description:
    "An open-source background agent and web interface to build, debug, and understand code.",
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

  if (process.env.VERCEL_ENV === "production") {
    console.log("PROD: Applying whitelist");
    const user = await getUser();

    // Only apply whitelist once user has logged in
    if (!user) {
      console.log("PROD: Not logged in");
      return;
    }

    console.log("PROD: User logged in", user);

    // Example: WHITELIST="user1@example.com,user2@example.com,admin@company.com"
    const whitelist = process.env.WHITELIST?.split(",") ?? [];

    console.log("PROD: Whitelist", whitelist);

    if (!whitelist.includes(user?.email ?? "")) {
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${departureMono.variable} overscroll-none antialiased`}
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
