import { BundledLanguage } from 'shiki';

/**
 * Detect language from file extension for syntax highlighting
 */
export function detectLanguageFromFilePath(filePath: string): BundledLanguage {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, BundledLanguage> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript', 
    'jsx': 'jsx',
    'json': 'json',
    'md': 'markdown',
    'css': 'css',
    'html': 'html',
    'htm': 'html',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'php': 'php',
    'rb': 'ruby',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'xml': 'xml',
    'sql': 'sql',
  };
  
  return extension ? languageMap[extension] || 'markdown' : 'markdown';
}

/**
 * Generate diff content with Shiki notation markers for search-replace operations
 */
export function generateSearchReplaceDiff(
  oldString: string,
  newString: string,
  filePath?: string
): { content: string; language: BundledLanguage } {
  const language = filePath ? detectLanguageFromFilePath(filePath) : 'markdown';
  
  // Split content into lines for proper diff display
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  
  // Build the diff content with Shiki notation
  const diffLines: string[] = [];
  
  // Add removed lines with [!code --] marker
  oldLines.forEach(line => {
    diffLines.push(`${line} // [!code --]`);
  });
  
  // Add added lines with [!code ++] marker  
  newLines.forEach(line => {
    diffLines.push(`${line} // [!code ++]`);
  });
  
  const content = diffLines.join('\n');
  
  return { content, language };
}

/**
 * Generate diff content with context lines around the change
 */
export function generateSearchReplaceDiffWithContext(
  oldString: string,
  newString: string,
  contextBefore?: string,
  contextAfter?: string,
  filePath?: string
): { content: string; language: BundledLanguage } {
  const language = filePath ? detectLanguageFromFilePath(filePath) : 'markdown';
  
  const diffLines: string[] = [];
  
  // Add context before (if provided)
  if (contextBefore) {
    const beforeLines = contextBefore.split('\n').filter(line => line.trim());
    beforeLines.forEach(line => {
      diffLines.push(line); // No marker = unchanged
    });
  }
  
  // Add removed lines
  const oldLines = oldString.split('\n');
  oldLines.forEach(line => {
    diffLines.push(`${line} // [!code --]`);
  });
  
  // Add added lines
  const newLines = newString.split('\n');
  newLines.forEach(line => {
    diffLines.push(`${line} // [!code ++]`);
  });
  
  // Add context after (if provided)
  if (contextAfter) {
    const afterLines = contextAfter.split('\n').filter(line => line.trim());
    afterLines.forEach(line => {
      diffLines.push(line); // No marker = unchanged
    });
  }
  
  const content = diffLines.join('\n');
  
  return { content, language };
}

/**
 * Create a simple unified diff display for small changes
 */
export function createSimpleDiff(
  oldString: string,
  newString: string,
  filePath?: string
): { content: string; language: BundledLanguage } {
  const language = filePath ? detectLanguageFromFilePath(filePath) : 'markdown';
  
  // For simple single-line or small changes, show before/after
  const diffLines: string[] = [];
  
  // If it's a single line change, show both on same "line"
  if (!oldString.includes('\n') && !newString.includes('\n')) {
    diffLines.push(`${oldString} // [!code --]`);
    diffLines.push(`${newString} // [!code ++]`);
  } else {
    // Multi-line changes
    const oldLines = oldString.split('\n');
    const newLines = newString.split('\n');
    
    oldLines.forEach(line => {
      diffLines.push(`${line} // [!code --]`);
    });
    
    newLines.forEach(line => {
      diffLines.push(`${line} // [!code ++]`);
    });
  }
  
  return {
    content: diffLines.join('\n'),
    language
  };
}