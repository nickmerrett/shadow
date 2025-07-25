import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import glob from "fast-glob";
import PineconeHandler from "../embedding/pineconeService";

interface MarkdownFile {
  id: string;
  metadata: {
    filePath: string;
    title: string;
    content: string;
    frontmatter: Record<string, any>;
    lastModified: string;
    lastIndexed: string;
  };
}

interface SearchOptions {
  query: string;
  topK?: number;
  filters?: Record<string, any>;
}

interface IndexOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  recursive?: boolean;
}

/**
 * ShallowWiki Markdown API
 * 
 * A focused API for storing and searching markdown files.
 */
export class MarkdownAPI {
  private pinecone: PineconeHandler;
  private namespace: string;

  /**
   * Create a new MarkdownAPI instance
   * @param repositoryPath The root path of the repository
   * @param namespacePrefix Optional prefix for the namespace (default: 'markdown')
   */
  constructor(private repositoryPath: string, namespacePrefix: string = 'markdown') {
    this.pinecone = new PineconeHandler();
    
    // Create a namespace based on repository path
    const repoHash = createHash('sha256').update(repositoryPath).digest('hex').slice(0, 12);
    this.namespace = `${namespacePrefix}_${repoHash}`;
  }

  /**
   * Parse frontmatter from markdown content
   * Simple implementation that extracts YAML frontmatter between --- delimiters
   */
  private parseFrontmatter(content: string): { frontmatter: Record<string, any>; content: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);
    
    if (!match || !match[1]) {
      return { frontmatter: {}, content };
    }

    try {
      const frontmatterStr = match[1];
      const frontmatter: Record<string, any> = {};
      
      // Very simple YAML-like parser
      frontmatterStr.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          frontmatter[key.trim()] = value;
        }
      });

      // Remove frontmatter from content
      const cleanContent = content.replace(frontmatterRegex, '');
      
      return { frontmatter, content: cleanContent };
    } catch (error) {
      console.error('Error parsing frontmatter:', error);
      return { frontmatter: {}, content };
    }
  }

  /**
   * Extract title from markdown content
   * Looks for the first heading or uses filename if none found
   */
  private extractTitle(content: string, filePath: string): string {
    // Try to find first heading in markdown
    const headingMatch = content.match(/^#\s+(.*)/m);
    if (headingMatch && headingMatch[1]) {
      return headingMatch[1].trim();
    }
    
    // Fall back to filename without extension
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Index a single markdown file
   * @param filePath Path to the markdown file, relative to the repository
   * @returns ID of the indexed document
   */
  async indexFile(filePath: string): Promise<string> {
    const absolutePath = path.join(this.repositoryPath, filePath);
    
    // Ensure file exists and is markdown
    if (!fs.existsSync(absolutePath) || path.extname(absolutePath).toLowerCase() !== '.md') {
      throw new Error(`File does not exist or is not markdown: ${filePath}`);
    }

    // Read file content
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const { frontmatter, content } = this.parseFrontmatter(fileContent);
    const title = frontmatter.title || this.extractTitle(content, filePath);
    
    // Create document ID
    const id = createHash('sha256').update(`markdown_${filePath}`).digest('hex').slice(0, 16);

    const markdownFile: MarkdownFile = {
      id,
      metadata: {
        filePath,
        title,
        content: fileContent,
        frontmatter,
        lastModified: new Date(fs.statSync(absolutePath).mtime).toISOString(),
        lastIndexed: new Date().toISOString()
      }
    };

    // Convert metadata to format Pinecone accepts (no nested objects)
    const pineconeRecord = {
      id: markdownFile.id,
      metadata: {
        filePath: markdownFile.metadata.filePath,
        title: markdownFile.metadata.title,
        text: markdownFile.metadata.content, // Used for embedding
        frontmatter: JSON.stringify(markdownFile.metadata.frontmatter),
        lastModified: markdownFile.metadata.lastModified,
        lastIndexed: markdownFile.metadata.lastIndexed,
        type: 'markdown'
      }
    };

    // Store in Pinecone
    await this.pinecone.upsertAutoEmbed([pineconeRecord], this.namespace);
    
    return id;
  }

  /**
   * Index multiple markdown files from a directory
   * @param options Options for indexing
   * @returns Results of the indexing operation
   */
  async indexDirectory(options: IndexOptions = {}): Promise<{
    count: number;
    files: string[];
    errors: { file: string; error: string }[];
  }> {
    const {
      includePatterns = ['**/*.md'],
      excludePatterns = ['**/node_modules/**', '**/.git/**'],
      recursive = true
    } = options;

    // Find markdown files
    const patterns = includePatterns.map(pattern => 
      recursive ? pattern : path.join(path.dirname(pattern), path.basename(pattern))
    );
    
    const files = await glob(patterns, {
      cwd: this.repositoryPath,
      ignore: excludePatterns,
      absolute: false
    });

    const results = {
      count: 0,
      files: [] as string[],
      errors: [] as { file: string; error: string }[]
    };

    // Process each file
    for (const file of files) {
      try {
        await this.indexFile(file);
        results.files.push(file);
        results.count++;
      } catch (error) {
        results.errors.push({
          file,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Search for markdown files
   * @param options Search options
   * @returns Search results
   */
  async search(options: SearchOptions): Promise<any[]> {
    try {
      const { query, topK = 10, filters } = options;
      
      // Build query with filters
      let searchQuery = query;
      if (filters) {
        const filterTerms = Object.entries(filters).map(([key, value]) => `${key}:${value}`);
        if (filterTerms.length > 0) {
          searchQuery = `${searchQuery} ${filterTerms.join(' ')}`;
        }
      }
      
      // Always filter to only markdown files
      searchQuery = `${searchQuery} type:markdown`;
      
      // Use the existing retrieval system for search
      const { retrieve } = await import("../retrieval.js");
      const results = await retrieve(searchQuery, this.namespace, topK);
      
      // Define the expected structure for a hit
      interface PineconeHit {
        id?: string;
        _id?: string;
        _score?: number;
        score?: number;
        metadata?: {
          filePath?: string;
          title?: string;
          text?: string;
          frontmatter?: string;
          lastModified?: string;
          lastIndexed?: string;
        };
      }
      
      return (results.result?.hits || []).map((hit: PineconeHit) => {
        return {
          id: hit.id || hit._id || '',
          score: hit.score || hit._score || 0,
          filePath: hit.metadata?.filePath || '',
          title: hit.metadata?.title || '',
          content: hit.metadata?.text || '',
          frontmatter: hit.metadata?.frontmatter ? JSON.parse(hit.metadata.frontmatter) : {},
          lastModified: hit.metadata?.lastModified || '',
          lastIndexed: hit.metadata?.lastIndexed || ''
        };
      });
    } catch (error) {
      console.error('Error searching markdown files:', error);
      return [];
    }
  }

  /**
   * Retrieve a single markdown file by its ID
   * @param id The document ID
   * @returns The markdown file or null if not found
   */
  async getById(id: string): Promise<any | null> {
    try {
      const results = await this.search({
        query: `id:${id}`
      });

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error(`Failed to get markdown file with ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Clear all indexed markdown files
   */
  async clear(): Promise<void> {
    try {
      await this.pinecone.clearNamespace(this.namespace);
    } catch (error) {
      console.error(`Failed to clear namespace ${this.namespace}:`, error);
      throw error;
    }
  }

  /**
   * Get the namespace used by this API
   */
  getNamespace(): string {
    return this.namespace;
  }
}

export default MarkdownAPI;
