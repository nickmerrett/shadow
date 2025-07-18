import { TaskLayoutContent } from "@/components/layout/task-layout";

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TaskLayoutContent>{children}</TaskLayoutContent>;
}
