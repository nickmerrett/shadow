import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex size-full flex-col">
      <div className="flex w-full items-center justify-between p-3">
        <SidebarTrigger />
        <div className="bg-muted-foreground size-8 rounded-full"></div>
      </div>
    </div>
  );
}
