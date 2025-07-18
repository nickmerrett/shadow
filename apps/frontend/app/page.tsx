import { PromptForm } from "@/components/chat/prompt-form";
import { HomeLayoutWrapper } from "@/components/layout/home";

export default function Home() {
  return (
    <HomeLayoutWrapper>
      <div className="mx-auto flex size-full max-w-lg flex-col items-center mt-24 gap-8">
        <div className="text-2xl font-medium">Shadow</div>
        <PromptForm isHome />
      </div>
    </HomeLayoutWrapper>
  );
}
