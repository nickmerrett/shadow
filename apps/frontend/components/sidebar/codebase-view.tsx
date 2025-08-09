"use client";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { File, Folder, Brain } from "lucide-react";
import { useMemo } from "react";
import { useCodebase } from "@/hooks/use-codebase";
import { FileIcon } from "../ui/file-icon";

export function SidebarCodebaseView({ codebaseId }: { codebaseId: string }) {
  const { data: codebase } = useCodebase(codebaseId);

  const summaries = useMemo(() => codebase?.summaries || [], [codebase]);

  // Organize summaries for table of contents
  const { repoSummaries, fileSummaries, directorySummaries } = useMemo(() => {
    const repoSummaries = summaries.filter((s) => s.type === "repo_summary");
    const fileSummaries = summaries.filter((s) => s.type === "file_summary");
    const directorySummaries = summaries.filter(
      (s) => s.type === "directory_summary"
    );
    return { repoSummaries, fileSummaries, directorySummaries };
  }, [summaries]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getFileName = (filePath: string) => {
    return filePath.split("/").pop() || filePath;
  };

  const removeFileExtension = (fileName: string) => {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < fileName.length - 1) {
      return fileName.substring(0, lastDotIndex);
    }
    return fileName;
  };

  if (summaries.length === 0) {
    return (
      <SidebarContent className="h-full">
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuItem>
              <SidebarMenuButton disabled>
                <span className="truncate">No documentation available</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent className="h-full">
      {/* Project Overview */}
      {repoSummaries.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            {repoSummaries.map((summary) => (
              <SidebarMenuItem key={summary.id}>
                <SidebarMenuButton onClick={() => scrollToSection(summary.id)}>
                  <Brain className="size-4 shrink-0" />
                  <span className="truncate">Project Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Files */}
      {fileSummaries.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Files</SidebarGroupLabel>
          <SidebarGroupContent>
            {fileSummaries.map((file) => (
              <SidebarMenuItem key={file.id}>
                <SidebarMenuButton onClick={() => scrollToSection(file.id)}>
                  <FileIcon
                    filename={file.filePath || ""}
                    useFallback
                    className="size-4 shrink-0"
                  />
                  <span className="truncate">{file.filePath}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Directories */}
      {directorySummaries.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Directories</SidebarGroupLabel>
          <SidebarGroupContent>
            {directorySummaries.map((directory) => (
              <SidebarMenuItem key={directory.id}>
                <SidebarMenuButton
                  onClick={() => scrollToSection(directory.id)}
                >
                  <Folder className="size-4 shrink-0" />
                  <span className="truncate">{directory.filePath}/</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </SidebarContent>
  );
}
