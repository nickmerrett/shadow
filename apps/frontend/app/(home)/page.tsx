import { HomePageContent } from "@/components/chat/home/home";
import { HomeLayoutWrapper } from "@/components/layout/home-layout";
import { getGitSelectorCookie } from "@/lib/actions/git-selector-cookie";
import { getModelSelectorCookie } from "@/lib/actions/model-selector-cookie";
import { getApiKeys, getModels } from "@/lib/actions/api-keys";
import { getModelProvider, AvailableModels } from "@repo/types";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { GitCookieDestroyer } from "@/components/task/git-cookie-destroyer";

export default async function Home() {
  const queryClient = new QueryClient();
  const initialGitCookieState = await getGitSelectorCookie();
  const savedModel = await getModelSelectorCookie();
  const apiKeys = await getApiKeys();

  const prefetchPromises = [
    queryClient
      .prefetchQuery({
        queryKey: ["models"],
        queryFn: getModels,
      })
      .catch((error) => {
        console.log("Could not prefetch models:", error?.message || error);
      }),
    queryClient
      .prefetchQuery({
        queryKey: ["api-keys"],
        queryFn: getApiKeys,
      })
      .catch((error) => {
        console.log("Could not prefetch API keys:", error?.message || error);
      }),
  ];

  await Promise.allSettled(prefetchPromises);

  // Since we're not prefetching GitHub status anymore, we can't check installation status
  // The GitCookieDestroyer component will handle this when GitHub components load
  const shouldDeleteGitCookie = false;

  // Validate saved model against available API keys
  let initialSelectedModel = savedModel;
  if (savedModel) {
    try {
      // Check if the saved model is valid (exists in AvailableModels)
      const isValidModel = Object.values(AvailableModels).includes(savedModel);

      if (isValidModel) {
        // Check if the model's provider has a valid API key
        const provider = getModelProvider(savedModel);
        const hasValidKey =
          provider === "openai"
            ? !!apiKeys.openai && apiKeys.openai.length > 0
            : !!apiKeys.anthropic && apiKeys.anthropic.length > 0;

        if (!hasValidKey) {
          initialSelectedModel = null;
        }
      } else {
        initialSelectedModel = null;
      }
    } catch (_error) {
      initialSelectedModel = null;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeLayoutWrapper>
        <HomePageContent
          initialGitCookieState={
            shouldDeleteGitCookie ? null : initialGitCookieState
          }
          initialSelectedModel={initialSelectedModel}
        />
        {/* There's no way to delete cookies from a server component so pass down to client component */}
        <GitCookieDestroyer shouldDeleteGitCookie={shouldDeleteGitCookie} />
      </HomeLayoutWrapper>
    </HydrationBoundary>
  );
}
