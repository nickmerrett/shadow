- Fixed-Size Chunking: split code into equal-sized pieces (by tokens or characters), regardless of meaning.
- Sentence/Statement Splitting: break code at each statement or line, like splitting at semicolons or newlines.
- Recursive Chunking: split code at big sections (like classes), then split those at smaller sections (like functions), repeating as needed.
- Semantic/Content-Aware Chunking: use code structure (functions, classes, comments) to make chunks that keep logical meaning.
- Graph-Based Chunking: turn code into a network of related parts (like functions and classes), and use these connected pieces as chunks.

Since we have tree-sitter for code AST parsing, it makes the most sense to break down code based on the structure of the AST.

- set thresholds for chunk sizes WITHIN functions
- functions by themselves need to be indexed if small enough

We need to take an inductive appraoch to retrieval
