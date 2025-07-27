import { WikiLayout } from "@/components/codebase/wiki-layout";

interface RepoPageProps {
  params: {
    repoId: string; // This is actually taskId in our DB schema
  };
}

export default async function RepoPage({ params }: RepoPageProps) {
  // Just use the param directly - keep it simple
  const { repoId } = await params;
  
  // Pass the taskId to WikiLayout
  return <WikiLayout taskId={repoId} />;
}
