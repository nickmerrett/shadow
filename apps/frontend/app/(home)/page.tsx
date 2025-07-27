import { HomePageContent } from "@/components/chat/home";
import { HomeLayoutWrapper } from "@/components/layout/home-layout";
import { getUser } from "@/lib/auth/get-user";
import {
  getGitHubRepositories,
  getGitHubStatus,
} from "@/lib/github/github-api";
import { getModels } from "@/lib/actions/get-models";
import {
  clearGitSelectorCookie,
  getGitSelectorCookie,
} from "@/lib/actions/save-git-selector-cookie";
import type { FilteredRepository, GitHubStatus } from "@/lib/github/types";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

export default async function Home() {
  const user = await getUser();
  const queryClient = new QueryClient();
  const initialGitState = await getGitSelectorCookie();

  const prefetchPromises = [
    queryClient
      .prefetchQuery({
        queryKey: ["github", "status"],
        queryFn: () => getGitHubStatus(user?.id),
      })
      .catch((error) => {
        console.log(
          "Could not prefetch GitHub status:",
          error?.message || error
        );
      }),
    queryClient
      .prefetchQuery({
        queryKey: ["github", "repositories"],
        queryFn: () => getGitHubRepositories(user?.id),
      })
      .catch((error) => {
        console.log(
          "Could not prefetch GitHub repositories:",
          error?.message || error
        );
      }),
    queryClient
      .prefetchQuery({
        queryKey: ["models"],
        queryFn: getModels,
      })
      .catch((error) => {
        console.log("Could not prefetch models:", error?.message || error);
      }),
  ];
  await Promise.allSettled(prefetchPromises);

  const githubStatus = queryClient.getQueryData<GitHubStatus>([
    "github",
    "status",
  ]);
  let finalGitState = initialGitState;

  if (initialGitState && githubStatus && !githubStatus.isAppInstalled) {
    await clearGitSelectorCookie();
    finalGitState = null;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeLayoutWrapper>
        <HomePageContent initialGitState={finalGitState} />
      </HomeLayoutWrapper>
    </HydrationBoundary>
  );
}
