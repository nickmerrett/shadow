import fs from 'fs';
import path from 'path';
import os from 'os';
import { MarkdownAPI } from './markdown-api';

// Mock the PineconeHandler
jest.mock('../embedding/pineconeService', () => {
  return {
    __esModule: true,
    default: class MockPineconeHandler {
      // Mock storage to simulate Pinecone database
      private mockStorage: Record<string, any[]> = {};
      
      async upsertAutoEmbed(records: any[], namespace: string) {
        if (!this.mockStorage[namespace]) {
          this.mockStorage[namespace] = [];
        }
        
        // Add or update records
        for (const record of records) {
          const index = this.mockStorage[namespace].findIndex(r => r.id === record.id);
          if (index >= 0) {
            this.mockStorage[namespace][index] = record;
          } else {
            this.mockStorage[namespace].push(record);
          }
        }
        
        return { upsertedCount: records.length };
      }
      
      async clearNamespace(namespace: string) {
        this.mockStorage[namespace] = [];
        return { success: true };
      }
      
      // Helper to get mock storage for testing
      getMockStorage(namespace: string) {
        return this.mockStorage[namespace] || [];
      }
    }
  };
});

// Mock the retrieval module
jest.mock('../retrieval', () => {
  return {
    __esModule: true,
    retrieve: jest.fn().mockImplementation((query, namespace, topK = 10) => {
      // Import the mocked PineconeHandler
      const PineconeHandler = require('../embedding/pineconeService').default;
      const pinecone = new PineconeHandler();
      
      // Get mock storage
      const records = pinecone.getMockStorage(namespace);
      
      // Simple mock implementation that filters by text content
      let results = records;
      
      // Extract any type: filter
      const typeMatch = query.match(/type:(\S+)/);
      if (typeMatch) {
        const typeFilter = typeMatch[1];
        results = results.filter(record => record.metadata.type === typeFilter);
      }
      
      // Filter by text content (very simplified)
      const searchTerms = query.replace(/type:\S+/, '').trim();
      if (searchTerms) {
        results = results.filter(record => 
          record.metadata.text.toLowerCase().includes(searchTerms.toLowerCase())
        );
      }
      
      // Sort by relevance (mock implementation)
      results = results.map(record => ({
        id: record.id,
        _id: record.id,
        score: 0.9, // Mock score
        _score: 0.9, // Mock score
        metadata: record.metadata
      })).slice(0, topK);
      
      return {
        result: {
          hits: results
        }
      };
    })
  };
});

describe('MarkdownAPI', () => {
  let tempDir: string;
  let markdownAPI: MarkdownAPI;
  
  beforeEach(() => {
    // Create a temporary directory for test markdown files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-api-test-'));
    markdownAPI = new MarkdownAPI(tempDir);
  });
  
  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  test('parseFrontmatter extracts YAML frontmatter correctly', () => {
    // Create a test file with frontmatter
    const testFilePath = path.join(tempDir, 'test.md');
    const content = `---
title: Test Document
author: Test User
tags: test, markdown, api
---
# Test Document

This is a test document.`;

    // Write test file
    fs.writeFileSync(testFilePath, content);
    
    // Index the file
    return markdownAPI.indexFile('test.md')
      .then(id => {
        // Search for the document
        return markdownAPI.getById(id);
      })
      .then(result => {
        // Check frontmatter
        expect(result).not.toBeNull();
        expect(result.frontmatter).toEqual({
          title: 'Test Document',
          author: 'Test User',
          tags: 'test, markdown, api'
        });
        
        // Check content
        expect(result.content).toContain('# Test Document');
        expect(result.content).toContain('This is a test document.');
        
        // Check title extraction
        expect(result.title).toBe('Test Document');
      });
  });
  
  test('indexDirectory properly indexes multiple markdown files', async () => {
    // Create multiple test markdown files
    const files = [
      {
        name: 'doc1.md',
        content: '# Document 1\n\nThis is the first test document.'
      },
      {
        name: 'doc2.md',
        content: '---\ntitle: Custom Title\n---\n# Document 2\n\nThis is the second test document.'
      },
      {
        name: 'subdir/doc3.md',
        content: '# Document 3\n\nThis is a document in a subdirectory.'
      }
    ];
    
    // Create subdirectory
    fs.mkdirSync(path.join(tempDir, 'subdir'));
    
    // Create each test file
    for (const file of files) {
      fs.writeFileSync(path.join(tempDir, file.name), file.content);
    }
    
    // Index all markdown files
    const results = await markdownAPI.indexDirectory();
    
    // Check results
    expect(results.count).toBe(3);
    expect(results.files).toHaveLength(3);
    expect(results.errors).toHaveLength(0);
    
    // Search for documents
    const searchResults = await markdownAPI.search({ query: 'test document' });
    
    // Check search results
    expect(searchResults).toHaveLength(2); // Only doc1 and doc2 contain "test document"
    
    // Verify document titles
    const titles = searchResults.map(r => r.title);
    expect(titles).toContain('Document 1');
    expect(titles).toContain('Custom Title');
  });
  
  test('search returns relevant results', async () => {
    // Create test files with specific content
    const files = [
      {
        name: 'react.md',
        content: '# React\n\nReact is a JavaScript library for building user interfaces.'
      },
      {
        name: 'vue.md',
        content: '# Vue\n\nVue is a progressive JavaScript framework.'
      },
      {
        name: 'angular.md',
        content: '# Angular\n\nAngular is a platform for building mobile and desktop web applications.'
      }
    ];
    
    // Create each test file
    for (const file of files) {
      fs.writeFileSync(path.join(tempDir, file.name), file.content);
    }
    
    // Index all files
    await markdownAPI.indexDirectory();
    
    // Search for JavaScript
    const jsResults = await markdownAPI.search({ query: 'JavaScript' });
    expect(jsResults).toHaveLength(2); // Only react.md and vue.md mention JavaScript
    
    // Search for framework
    const frameworkResults = await markdownAPI.search({ query: 'framework' });
    expect(frameworkResults).toHaveLength(1); // Only vue.md mentions framework
    
    // Search for library
    const libraryResults = await markdownAPI.search({ query: 'library' });
    expect(libraryResults).toHaveLength(1); // Only react.md mentions library
  });
  
  test('clear removes all indexed documents', async () => {
    // Create and index a test file
    fs.writeFileSync(path.join(tempDir, 'test.md'), '# Test\n\nTest content.');
    await markdownAPI.indexFile('test.md');
    
    // Verify document exists
    const searchBefore = await markdownAPI.search({ query: 'Test' });
    expect(searchBefore).toHaveLength(1);
    
    // Clear the index
    await markdownAPI.clear();
    
    // Verify document no longer exists
    const searchAfter = await markdownAPI.search({ query: 'Test' });
    expect(searchAfter).toHaveLength(0);
  });
});
