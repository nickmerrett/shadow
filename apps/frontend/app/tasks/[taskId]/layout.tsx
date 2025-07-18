import { LayoutContent } from "@/components/layout/content";

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutContent>{children}</LayoutContent>;
}
