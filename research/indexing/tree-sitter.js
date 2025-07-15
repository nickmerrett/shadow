#!/usr/bin/env node

// run node research/indexing/tree-sitter.js ./apps/frontend/app/page.tsx
// requries you to install
// "tree-sitter": "^0.21.1",
// "tree-sitter-cli": "^0.25.8",
// tree-sitter-typescript": "^0.23.2"
const fs = require('fs');
const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript').typescript;
const TSX = require('tree-sitter-typescript').tsx;

function parseFile(filePath) {
  const parser = new Parser();
  
  // Determine language based on file extension
  if (filePath.endsWith('.tsx')) {
    parser.setLanguage(TSX);
    console.log('Parsing as TSX...');
  } else if (filePath.endsWith('.ts')) {
    parser.setLanguage(TypeScript);
    console.log('Parsing as TypeScript...');
  } else {
    console.error('Unsupported file type. Only .ts and .tsx files are supported.');
    process.exit(1);
  }

  try {
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    const tree = parser.parse(sourceCode);
    
    console.log('Parse successful!');
    console.log('Root node:', tree.rootNode.type);
    console.log('Child count:', tree.rootNode.childCount);
    
    // Print syntax tree (first 20 lines to avoid overwhelming output)
    const treeString = tree.rootNode.toString();
    const lines = treeString.split('\n');
    console.log('\nSyntax tree (first 20 lines):');
    console.log(lines.slice(0, 20).join('\n'));
    
    if (lines.length > 20) {
      console.log(`... (${lines.length - 20} more lines)`);
    }
    
  } catch (error) {
    console.error('Error parsing file:', error.message);
    process.exit(1);
  }
}

// Get file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node parse-typescript.js <file-path>');
  console.error('Example: node parse-typescript.js ./apps/frontend/app/page.tsx');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

parseFile(filePath); 
