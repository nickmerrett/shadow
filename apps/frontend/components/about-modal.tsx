"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogoHover } from "@/components/graphics/logo/logo-hover";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="mb-4 border-b pb-4">
          <DialogTitle className="font-departureMono flex items-center gap-4 text-2xl font-medium tracking-tighter">
            <LogoHover size="md" forceAnimate />
            About{" "}
            <span className="text-muted-foreground inline-flex items-center gap-2">
              Shadow
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto pr-2">
          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                What is Shadow?
              </h2>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                Shadow is a powerful AI coding agent designed to work alongside
                developers, understanding your codebase and helping you build
                better software. Think of it as having an intelligent coding
                partner that can read your entire project, understand the
                context, and help you implement features, fix bugs, and improve
                your code.
              </p>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                Unlike traditional AI coding assistants that work in isolation,
                Shadow integrates deeply with your GitHub repositories. It can
                analyze your entire codebase, understand the relationships
                between files, and provide contextually relevant suggestions
                that actually make sense for your specific project.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                How It Works
              </h2>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                Shadow transforms your codebase into an intelligent development
                environment. When you connect a repository, it performs a deep
                analysis of your entire codebase, examining individual files and
                the complex relationships between them.
              </p>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Tree-Sitter Parsing</h3>
                <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                  Shadow uses tree-sitter parsers for JavaScript, TypeScript,
                  and TSX to extract symbols, function definitions, and import
                  statements. It builds a semantic graph of your codebase with
                  GraphNode and GraphEdge relationships.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">
                  Shadow Wiki Generation
                </h3>
                <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                  The system creates hierarchical summaries using the buildTree
                  function, processing files in batches with dynamic sizing. It
                  uses different models—faster models for file analysis and more
                  powerful models for directory summaries. We only look for the
                  most important information and refer to call graphs more than
                  reading calls, meaning we can understand codebase architecture
                  in ~ 10 seconds, instead of 10 minutes. We have found our
                  optimized algorithm provides enough information for language
                  models, as we are not optimizing for human understanding.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Memory System</h3>
                <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                  Shadow uses a repository-specific memory system that stores
                  knowledge about your codebase. Memories are categorized and
                  linked to specific tasks, allowing the AI to recall previous
                  decisions and patterns when working on similar problems.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Semantic Indexing</h3>
                <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                  Code is processed through an embedding pipeline using models
                  like Jina or local transformers. The system creates vector
                  embeddings that are stored in Pinecone for efficient semantic
                  search, enabling natural language queries to find relevant
                  code.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Execution Environment</h3>
                <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                  Shadow supports both local and remote execution modes. Remote
                  mode uses Kata QEMU containers on AWS EKS with hardware-level
                  VM isolation. Each task runs in its own isolated environment
                  with dedicated resources and networking.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Tool System</h3>
                <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                  The agent has access to comprehensive tools including file
                  operations (read_file, edit_file, search_replace), terminal
                  commands (run_terminal_cmd), code search (grep_search,
                  semantic_search), and task management (todo_write,
                  add_memory).
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                The Experience
              </h2>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                Using Shadow feels like having a coding partner who knows your
                project inside and out. Connect your repository, and within
                seconds, Shadow has a deep understanding of your codebase that
                it can leverage for any task.
              </p>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                When you create a task, you get a collaborative development
                session. Shadow can read your files, understand the context,
                make intelligent modifications, and create pull requests when
                you&apos;re ready to merge changes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                AWS Infrastructure
              </h2>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                Shadow runs on AWS with production-grade infrastructure. The
                backend is deployed on ECS with Application Load Balancer, while
                remote execution uses EKS with Kata QEMU containers for true
                hardware isolation.
              </p>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                The system uses Amazon Linux 2023 nodes with KVM support,
                enabling Kata QEMU microVMs that provide VM-level isolation for
                secure code execution. Each task runs in its own isolated
                environment with dedicated resources and networking.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Team</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base font-medium">
                    <a
                      href="https://x.com/ishaandey_"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Ishaan Dey
                    </a>
                  </h3>
                  <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                    Software Engineering @ University of Waterloo, Prev @
                    Vercel. Architecture, design, remote mode implementation,
                    full-stack development, and agent workflow.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-medium">
                    <a
                      href="https://x.com/_rajanagarwal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Rajan Agarwal
                    </a>
                  </h3>
                  <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                    Software Engineering @ University of Waterloo, MoTS Intern @
                    Amazon AGI Lab. Codebase understanding, semantic search,
                    indexing, Shadow Wiki, memory algorithms, and LLM
                    integrations.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-medium">
                    <a
                      href="https://x.com/elijahkurien"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Elijah Kurien
                    </a>
                  </h3>
                  <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                    Software Engineering @ University of Waterloo, MoTS Intern @
                    Yutori. Frontend development, user interface, and real-time
                    collaboration features.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
