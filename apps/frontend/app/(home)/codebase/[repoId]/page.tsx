import { DocsView } from "@/components/codebase/docs-view";

interface RepoPageProps {
  params: {
    repoId: string; // This is actually taskId in our DB schema
  };
}

export default async function RepoPage({ params }: RepoPageProps) {
  // Just use the param directly - keep it simple
  const { repoId } = await params;
  
  // Return the repo docs view directly, which will be wrapped by the main layout
  return <DocsView taskId={repoId} />;

}
