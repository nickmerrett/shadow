import { CodebaseDetailView } from "@/components/codebase/codebase-detail-view";

interface CodebaseDetailPageProps {
  params: {
    repoId: string;
  };
}

export default function CodebaseDetailPage({ params }: CodebaseDetailPageProps) {
  return <CodebaseDetailView repoId={params.repoId} />;
}
