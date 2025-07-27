"use server";

import { cookies } from "next/headers";

const cookieNames = {
  taskLayout: "resizable-task-layout",
  agentEnvironment: "resizable-agent-environment",
} as const;

type CookieName = keyof typeof cookieNames;

export async function saveLayoutCookie(
  cookieName: CookieName,
  layout: number[]
) {
  const cookieStore = await cookies();

  cookieStore.set(cookieNames[cookieName], JSON.stringify(layout), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
