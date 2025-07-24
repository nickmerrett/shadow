"use server";

import { cookies } from "next/headers";
import type { FilteredRepository } from "@/lib/github/types";

const cookieNames = {
  taskLayout: "resizable-task-layout",
  agentEnvironment: "resizable-agent-environment",
  gitSelector: "git-selector-state",
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

export async function saveGitSelectorCookie(gitState: {
  repo: FilteredRepository | null;
  branch: {
    name: string;
    commitSha: string;
  } | null;
}) {
  const cookieStore = await cookies();

  cookieStore.set(cookieNames.gitSelector, JSON.stringify(gitState), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearGitSelectorCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieNames.gitSelector);
}
