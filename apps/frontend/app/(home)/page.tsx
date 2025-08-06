import { HomePageContent } from "@/components/chat/home";
import { HomeLayoutWrapper } from "@/components/layout/home-layout";
import { getUser } from "@/lib/auth/get-user";
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

// Helper function for timing operations in development
async function timeOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  return { result, duration };
}

function timeSync<T>(name: string, operation: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;
  return { result, duration };
}

export default async function Home() {
  const timings: Record<string, number> = {};
  
  const { result: user, duration: userDuration } = await timeOperation("getUser", () => getUser());
  timings.getUser = userDuration;
  
  const queryClient = new QueryClient();
  
  const { result: initialGitCookieState, duration: gitCookieDuration } = await timeOperation(
    "getGitSelectorCookie", 
    () => getGitSelectorCookie()
  );
  timings.getGitSelectorCookie = gitCookieDuration;
  
  const { result: savedModel, duration: modelCookieDuration } = await timeOperation(
    "getModelSelectorCookie", 
    () => getModelSelectorCookie()
  );
  timings.getModelSelectorCookie = modelCookieDuration;
  
  const { result: apiKeys, duration: apiKeysDuration } = await timeOperation("getApiKeys", () => getApiKeys());
  timings.getApiKeys = apiKeysDuration;

  const prefetchTimings: Record<string, number> = {};

  const modelsPromise = timeOperation("Models", () =>
    queryClient
      .prefetchQuery({
        queryKey: ["models"],
        queryFn: getModels,
      })
      .catch((error) => {
        console.log("Could not prefetch models:", error?.message || error);
      })
  ).then(({ result, duration }) => {
    prefetchTimings.models = duration;
    return result;
  });

  const apiKeysPromise = timeOperation("API Keys", () =>
    queryClient
      .prefetchQuery({
        queryKey: ["api-keys"],
        queryFn: getApiKeys,
      })
      .catch((error) => {
        console.log("Could not prefetch API keys:", error?.message || error);
      })
  ).then(({ result, duration }) => {
    prefetchTimings.apiKeys = duration;
    return result;
  });

  const prefetchPromises = [modelsPromise, apiKeysPromise];

  const prefetchStart = performance.now();
  await Promise.allSettled(prefetchPromises);
  const prefetchTotal = performance.now() - prefetchStart;
  timings.prefetchTotal = prefetchTotal;

  // Since we're not prefetching GitHub status anymore, we can't check installation status
  // The GitCookieDestroyer component will handle this when GitHub components load
  const shouldDeleteGitCookie = false;

  // Validate saved model against available API keys
  const { result: initialSelectedModel, duration: validationDuration } = timeSync("Model Validation", () => {
    let model = savedModel;
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
            model = null;
          }
        } else {
          // Invalid model, clear it
          model = null;
        }
      } catch (_error) {
        // Error validating model, clear it
        model = null;
      }
    }
    return model;
  });
  timings.modelValidation = validationDuration;

  // Log comprehensive timing summary in development
  if (process.env.NODE_ENV === 'development') {
    const totalTime = Object.values(timings).reduce((sum, time) => sum + time, 0);
    const slowThreshold = 100; // ms
    
    console.log('\n🏠 [Home Page Timing]');
    console.log('├── Individual Operations:');
    console.log(`│   ├── getUser: ${timings.getUser.toFixed(2)}ms${timings.getUser > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log(`│   ├── getGitSelectorCookie: ${timings.getGitSelectorCookie.toFixed(2)}ms${timings.getGitSelectorCookie > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log(`│   ├── getModelSelectorCookie: ${timings.getModelSelectorCookie.toFixed(2)}ms${timings.getModelSelectorCookie > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log(`│   └── getApiKeys: ${timings.getApiKeys.toFixed(2)}ms${timings.getApiKeys > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log('├── Prefetch Operations:');
    console.log(`│   ├── Total Prefetch Time: ${timings.prefetchTotal.toFixed(2)}ms${timings.prefetchTotal > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    if (Object.keys(prefetchTimings).length > 0) {
      console.log(`│   ├── Models: ${(prefetchTimings.models || 0).toFixed(2)}ms${(prefetchTimings.models || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   └── API Keys: ${(prefetchTimings.apiKeys || 0).toFixed(2)}ms${(prefetchTimings.apiKeys || 0) > slowThreshold ? ' ⚠️ SLOW' : ''}`);
      console.log(`│   📝 Note: GitHub data loads on-demand when user opens selector`);
    }
    console.log('├── Other Operations:');
    console.log(`│   └── Model Validation: ${timings.modelValidation.toFixed(2)}ms${timings.modelValidation > slowThreshold ? ' ⚠️ SLOW' : ''}`);
    console.log(`└── Total Time: ${totalTime.toFixed(2)}ms${totalTime > 500 ? ' ⚠️ SLOW' : totalTime > 1000 ? ' 🐌 VERY SLOW' : ''}`);
    console.log('');
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
