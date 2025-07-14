"use client";

import {
  Archive,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Folder,
  GitBranch,
  Home,
  Inbox,
  Monitor,
  Search,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { useState } from "react";
import { usePathname } from "next/navigation";

const buttons = [
  {
    title: "All Tasks",
    url: "/tasks",
    icon: Folder,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

const taskSections = [
  {
    title: "Ready for Review",
    icon: CheckCircle2,
    items: [
      {
        id: "1",
        name: "Optimize terminal emulator websocket event handling",
        repo: "ishaan1013/shadow",
        branch: "main",
        status: "Ready for Review",
      },
      {
        id: "2",
        name: "Optimize filesystem API routing",
        repo: "ishaan1013/shadow",
        branch: "main",
        status: "Ready for Review",
      },
    ],
  },
  {
    title: "In Progress",
    icon: CircleDashed,
    items: [
      {
        id: "3",
        name: "Optimize terminal emulator websocket event handling",
        repo: "ishaan1013/shadow",
        branch: "main",
        status: "Ready for Review",
      },
      {
        id: "4",
        name: "Optimize filesystem API routing",
        repo: "ishaan1013/shadow",
        branch: "main",
        status: "Ready for Review",
      },
    ],
  },
  {
    title: "Archive",
    icon: Archive,
    items: [
      {
        id: "5",
        name: "Optimize terminal emulator websocket event handling",
        repo: "ishaan1013/shadow",
        branch: "main",
        status: "Ready for Review",
      },
    ],
  },
];

export function SidebarComponent() {
  const pathname = usePathname();
  const isTaskPage = pathname.match(/^\/tasks\/[^/]+$/);

  const [activeView, setActiveView] = useState<"home" | "task">(
    isTaskPage ? "task" : "home",
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex w-full items-center justify-between">
            <div className="flex size-9 items-center justify-center">
              <Image src="/shadow.svg" alt="Logo" width={22} height={22} />
            </div>
            {isTaskPage && (
              <SidebarViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
              />
            )}
          </div>
        </SidebarGroup>
        <div className="flex flex-col gap-4">
          <SidebarGroup className="mt-6 gap-4">
            <SidebarGroupContent>
              <Button asChild className="w-full">
                <Link href="/">New Task</Link>
              </Button>
            </SidebarGroupContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {buttons.map((button) => (
                  <SidebarMenuItem key={button.title}>
                    <SidebarMenuButton asChild>
                      <a href={button.url}>
                        <button.icon />
                        <span>{button.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {taskSections.map((section) => (
            <Collapsible
              key={section.title}
              defaultOpen={section.title !== "Archive"}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger>
                    <section.icon className="mr-1.5 !size-3.5" />
                    {section.title}
                    <ChevronDown className="ml-auto -rotate-90 transition-transform group-data-[state=open]/collapsible:rotate-0" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    {section.items.map((task) => (
                      <SidebarMenuItem key={task.id}>
                        <SidebarMenuButton
                          className="flex h-auto flex-col items-start gap-0"
                          asChild
                        >
                          <a href={`/tasks/${task.id}`}>
                            <div className="line-clamp-1 w-full">
                              {task.name}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Folder className="size-3" /> {task.repo}{" "}
                              <GitBranch className="size-3" /> {task.branch}
                            </div>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

function SidebarViewSwitcher({
  activeView,
  setActiveView,
}: {
  activeView: "home" | "task";
  setActiveView: (view: "home" | "task") => void;
}) {
  return (
    <div className="bg-accent border-sidebar-border flex gap-0.5 rounded-full border p-[3px]">
      <Button
        size="iconSm"
        variant={activeView === "home" ? "default" : "ghost"}
        onClick={() => setActiveView("home")}
        className={
          activeView === "home"
            ? "rounded-full"
            : "text-muted-foreground hover:text-primary rounded-full hover:bg-transparent"
        }
      >
        <Monitor className="size-4" />
      </Button>
      <Button
        size="iconSm"
        variant={activeView === "task" ? "default" : "ghost"}
        onClick={() => setActiveView("task")}
        className={
          activeView === "task"
            ? "rounded-full"
            : "text-muted-foreground hover:text-primary rounded-full hover:bg-transparent"
        }
      >
        <Brain className="size-4" />
      </Button>
    </div>
  );
}
