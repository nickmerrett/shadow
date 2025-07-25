import path from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";

interface DeepWikiOptions {
    concurrency?: number;
    model?: string;
    modelMini?: string;
}

interface DeepWikiResult {
    outputPath: string;
    tokenUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        gpt4Calls: number;
        gpt4MiniCalls: number;
        fileAnalyses: number;
        directorySummaries: number;
        rootSummary: number;
    };
    filesProcessed: number;
    directoriesProcessed: number;
    processingTimeMs: number;
}

export async function runDeepWiki(repoPath: string, options: DeepWikiOptions = {}): Promise<DeepWikiResult> {
    const startTime = Date.now();

    // Validate repository path
    if (!existsSync(repoPath)) {
        throw new Error(`Repository path does not exist: ${repoPath}`);
    }

    // Set up environment variables
    const env = {
        ...process.env,
        CONCURRENCY: (options.concurrency || 12).toString(),
        MODEL: options.model || "gpt-4o",
        MODEL_MINI: options.modelMini || "gpt-4o-mini"
    };

    return new Promise((resolve, reject) => {
        // Get the directory of this file using __dirname (CommonJS)
        const indexerPath = path.join(__dirname, "index.ts");

        // Spawn the indexer as a separate process
        const child = spawn("npx", ["ts-node", indexerPath, repoPath], {
            env,
            stdio: "pipe",
            cwd: __dirname
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
            stdout += data.toString();
            console.log(data.toString()); // Forward output to console
        });

        child.stderr?.on("data", (data) => {
            stderr += data.toString();
            console.error(data.toString()); // Forward errors to console
        });

        child.on("close", (code) => {
            const endTime = Date.now();
            const processingTimeMs = endTime - startTime;

            if (code === 0) {
                // Parse token usage from output (basic implementation)
                const tokenRegex = /Total Tokens: ([\d,]+)/;
                const match = stdout.match(tokenRegex);
                const totalTokens = match ? parseInt(match[1]!.replace(/,/g, "")) : 0;

                // Parse file counts from output
                const dirRegex = /Dir:/g;
                const filesProcessed = stdout.match(/✅ File:/)?.length || 0;
                const directoriesProcessed = stdout.match(dirRegex)?.length || 0;

                resolve({
                    outputPath: path.join(repoPath, ".shadow", "tree"),
                    tokenUsage: {
                        promptTokens: Math.floor(totalTokens * 0.7), // Rough estimate
                        completionTokens: Math.floor(totalTokens * 0.3), // Rough estimate
                        totalTokens,
                        gpt4Calls: 0, // Would need to parse from output
                        gpt4MiniCalls: 0, // Would need to parse from output
                        fileAnalyses: filesProcessed,
                        directorySummaries: directoriesProcessed,
                        rootSummary: 1
                    },
                    filesProcessed,
                    directoriesProcessed,
                    processingTimeMs
                });
            } else {
                reject(new Error(`DeepWiki indexing failed with code ${code}: ${stderr}`));
            }
        });

        child.on("error", (error) => {
            reject(new Error(`Failed to start DeepWiki indexer: ${error.message}`));
        });
    });
}
