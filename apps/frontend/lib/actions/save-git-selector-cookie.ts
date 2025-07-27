"use server";

import { cookies } from "next/headers";
import type { FilteredRepository } from "@/lib/github/types";

const GIT_SELECTOR_COOKIE_NAME = "git-selector-state";

export async function saveGitSelectorCookie(gitState: {
  repo: FilteredRepository | null;
  branch: {
    name: string;
    commitSha: string;
  } | null;
}) {
  const cookieStore = await cookies();

  cookieStore.set(GIT_SELECTOR_COOKIE_NAME, JSON.stringify(gitState), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearGitSelectorCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(GIT_SELECTOR_COOKIE_NAME);
}

export async function getGitSelectorCookie(): Promise<{
  repo: FilteredRepository | null;
  branch: { name: string; commitSha: string } | null;
} | null> {
  const cookieStore = await cookies();
  const gitSelectorCookie = cookieStore.get(GIT_SELECTOR_COOKIE_NAME);
  
  if (gitSelectorCookie?.value) {
    try {
      return JSON.parse(gitSelectorCookie.value);
    } catch {
      // Invalid JSON, return null
      return null;
    }
  }
  
  return null;
}