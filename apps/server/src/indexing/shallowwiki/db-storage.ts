import { db } from "@repo/db";
import { createHash } from "crypto";

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface SummaryMetadata {
  type: 'file_summary' | 'directory_summary' | 'root_overview';
  repoPath?: string;
  filePath?: string;
  language?: string;
  symbols?: string[];
  dependencies?: string[];
  complexity?: number;
  lastUpdated: string;
  tokenUsage?: TokenUsage;
}

export class DbWikiStorage {
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  private generateId(type: string, path: string): string {
    return createHash('sha256').update(`${type}_${path}`).digest('hex').slice(0, 16);
  }

  /**
   * Clear all CodebaseUnderstanding entries for this task
   */
  async clearRepository(): Promise<void> {
    try {
      await db.codebaseUnderstanding.deleteMany({
        where: {
          taskId: this.taskId
        }
      });
      console.log(`🗑️  Cleared CodebaseUnderstanding data for task: ${this.taskId}`);
    } catch (error) {
      console.error(`Failed to clear CodebaseUnderstanding for task ${this.taskId}:`, error);
    }
  }

  /**
   * Store or update file summary in the database.
   * If a summary for this file already exists, it will be overwritten.
   */
  async storeFileSummary(
    repoPath: string,
    filePath: string,
    summary: string,
    symbols: string[] = [],
    dependencies: string[] = [],
    language?: string,
    complexity: number = 0,
    tokenUsage?: TokenUsage
  ): Promise<void> {
    // Create the content for storage - include metadata in the content
    const metadata: SummaryMetadata = {
      type: 'file_summary',
      repoPath,
      filePath,
      language,
      symbols,
      dependencies,
      complexity,
      lastUpdated: new Date().toISOString(),
      tokenUsage
    };

    const fullContent = JSON.stringify({
      metadata,
      summary
    });

    await this.upsertRecord(filePath, fullContent);
  }

  /**
   * Store or update directory summary in the database.
   * If a summary for this directory already exists, it will be overwritten.
   */
  async storeDirectorySummary(
    repoPath: string,
    dirPath: string,
    summary: string,
    childFiles: string[] = [],
    childDirs: string[] = [],
    tokenUsage?: TokenUsage
  ): Promise<void> {
    // Create the content for storage - include metadata in the content
    const metadata: SummaryMetadata = {
      type: 'directory_summary',
      repoPath,
      filePath: dirPath,
      symbols: childFiles,
      dependencies: childDirs,
      complexity: childFiles.length + childDirs.length,
      lastUpdated: new Date().toISOString(),
      tokenUsage
    };

    const fullContent = JSON.stringify({
      metadata,
      summary
    });

    await this.upsertRecord(dirPath, fullContent);
  }

  /**
   * Store or update root overview in the database.
   * If a root overview already exists, it will be overwritten.
   */
  async storeRootOverview(
    repoPath: string,
    overview: string,
    totalFiles: number,
    totalDirs: number,
    tokenUsage?: TokenUsage
  ): Promise<void> {
    // Create the content for storage - include metadata in the content
    const metadata: SummaryMetadata = {
      type: 'root_overview',
      repoPath,
      symbols: [],
      dependencies: [],
      complexity: totalFiles + totalDirs,
      lastUpdated: new Date().toISOString(),
      tokenUsage
    };

    const fullContent = JSON.stringify({
      metadata,
      summary: overview
    });

    await this.upsertRecord('root_overview', fullContent);
  }

  /**
   * Internal method to create or update a record in the database
   */
  private async upsertRecord(
    fileName: string,
    content: string
  ): Promise<void> {
    try {
      // Generate a unique ID for the file
      const recordId = this.generateId(fileName, this.taskId);
      
      // Parse content to extract metadata
      let parsedContent;
      let type = "file_summary";
      let filePath = "";
      let language = null;
      
      try {
        parsedContent = JSON.parse(content);
        if (parsedContent.metadata?.type) {
          type = parsedContent.metadata.type;
        }
        if (parsedContent.metadata?.filePath) {
          filePath = parsedContent.metadata.filePath;
        }
        if (parsedContent.metadata?.language) {
          language = parsedContent.metadata.language;
        }
      } catch (e) {
        console.warn("Could not parse content JSON", e);
        parsedContent = { content };
      }
      
      const now = new Date();
      
      // Create or update the record
      await db.codebaseUnderstanding.upsert({
        where: {
          id: recordId
        },
        update: {
          content: content,
          type: type,
          filePath: filePath,
          language: language,
          updatedAt: now
        },
        create: {
          id: recordId,
          taskId: this.taskId,
          fileName: fileName,
          content: content,
          type: type,
          filePath: filePath,
          language: language,
          createdAt: now,
          updatedAt: now
        }
      });

      console.log(`💾 Stored ${fileName}`);
    } catch (error) {
      console.error(`Failed to store record for ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Get all summaries for this task
   */
  async getAllSummaries(): Promise<any[]> {
    try {
      const records = await db.codebaseUnderstanding.findMany({
        where: {
          taskId: this.taskId
        }
      });

      return records.map((record: any) => {
        const parsed = this.parseContent(record.content, record.id);
        return {
          id: record.id,
          metadata: {
            ...parsed.metadata,
            text: parsed.summary // Include summary in text field for compatibility
          }
        };
      });
    } catch (error) {
      console.error(`Failed to get summaries for task ${this.taskId}:`, error);
      return [];
    }
  }

  /**
   * Helper method to parse stored content JSON
   */
  private parseContent(content: any, recordId: string): { metadata: SummaryMetadata, summary: string } {
    try {
      // Handle case where content is already a parsed JSON object
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      return {
        metadata: parsed.metadata || {
          type: 'file_summary',
          lastUpdated: new Date().toISOString(),
        },
        summary: parsed.summary || ''
      };
    } catch (e) {
      console.error(`Error parsing content for record ${recordId}:`, e);
      // Return fallback if parsing fails
      return {
        metadata: {
          type: 'file_summary',
          lastUpdated: new Date().toISOString(),
        },
        summary: typeof content === 'string' ? content : JSON.stringify(content) // Use the raw content as the summary
      };
    }
  }

  /**
   * Get file summary by file path
   */
  async getFileSummary(filePath: string): Promise<any | null> {
    try {
      const record = await db.codebaseUnderstanding.findFirst({
        where: {
          taskId: this.taskId,
          fileName: filePath
        }
      });

      if (!record) return null;
      
      const parsed = this.parseContent(record.content, record.id);

      return {
        id: record.id,
        metadata: {
          ...parsed.metadata,
          summary: parsed.summary,
          text: parsed.summary
        }
      };
    } catch (error) {
      console.error(`Error getting file summary for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get directory summary by directory path
   */
  async getDirectorySummary(dirPath: string): Promise<any | null> {
    return this.getFileSummary(dirPath);
  }

  /**
   * Get root overview
   */
  async getRootOverview(): Promise<any | null> {
    return this.getFileSummary('root_overview');
  }
  
  /**
   * Get a namespace identifier (needed for API compatibility with Pinecone version)
   */
  getNamespace(): string {
    return `codebase_${this.taskId}`;
  }
}

export default DbWikiStorage;
