import { PromptForm } from "@/components/chat/prompt-form";

export default function Home() {
  return (
    <div className="mx-auto flex size-full max-w-lg flex-col items-center mt-24 gap-8">
      <div className="text-2xl font-medium">Shadow</div>
      <PromptForm isHome />
    </div>
  );
}
