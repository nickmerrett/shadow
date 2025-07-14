import { SidebarTrigger } from "@/components/ui/sidebar";
import { PromptForm } from "@/components/home/prompt-form";

export default function Home() {
  return (
    <div className="flex size-full flex-col">
      <div className="flex w-full items-center justify-between p-3">
        <SidebarTrigger />
        <div className="bg-muted-foreground size-8 rounded-full"></div>
      </div>
      <div className="mx-auto flex w-full max-w-lg grow flex-col items-center pt-32">
        <PromptForm />
      </div>
    </div>
  );
}
