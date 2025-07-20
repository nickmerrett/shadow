import { PromptForm } from "@/components/chat/prompt-form";
import { HomeLayoutWrapper } from "@/components/layout/home-layout";
import { getGitHubRepositories } from "@/lib/github-api";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

export default async function Home() {
  const queryClient = new QueryClient();

  // Prefetch GitHub repositories for better UX when user opens repository selector
  try {
    await queryClient.prefetchQuery({
      queryKey: ["github", "repositories"],
      queryFn: getGitHubRepositories,
    });
  } catch (error) {
    // Silently fail - user might not have GitHub connected
    console.log("Could not prefetch GitHub repositories:", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeLayoutWrapper>
        <div className="mx-auto flex size-full max-w-lg flex-col items-center mt-24 gap-8">
          <div className="text-2xl font-medium">Shadow</div>
          <PromptForm isHome />
        </div>
      </HomeLayoutWrapper>
    </HydrationBoundary>
  );
}
