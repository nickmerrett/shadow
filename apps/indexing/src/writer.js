// We should be able to write to the demo repo and then have it indexed and searchable

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class Writer {
  constructor(repoPath = './demo') {
    this.repoPath = path.resolve(repoPath);
    this.indexPath = path.join(this.repoPath, '.shadow');
    this.fileHashes = new Map();
    this.loadFileHashes();
  }

  // Load existing file hashes for diff detection
  loadFileHashes() {
    const hashFile = path.join(this.indexPath, 'file-hashes.json');
    if (fs.existsSync(hashFile)) {
      const hashes = JSON.parse(fs.readFileSync(hashFile, 'utf8'));
      this.fileHashes = new Map(Object.entries(hashes));
    }
  }

  // Save current file hashes
  saveFileHashes() {
    if (!fs.existsSync(this.indexPath)) {
      fs.mkdirSync(this.indexPath, { recursive: true });
    }
    const hashFile = path.join(this.indexPath, 'file-hashes.json');
    const hashes = Object.fromEntries(this.fileHashes);
    fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 2));
  }

  // Calculate file hash
  getFileHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha1').update(content).digest('hex');
  }

  // Computes and stores file hashes for all files in the repo
  scanRepo(){
    const scanDir = (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            const relativePath = path.relative(this.repoPath, fullPath);
            // Hardcode this for now
            if (relativePath.startsWith('.') || relativePath.startsWith('node_modules')) continue;
            if (file.isDirectory()) {
                scanDir(fullPath);
            } else if (file.isFile()) {
                // Hardcode this for now
                const supportedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb'];
                const ext = path.extname(file.name);
                
                if (supportedExtensions.includes(ext)) {
                  const hash = this.getFileHash(fullPath);
                  this.fileHashes.set(relativePath, hash);
                  console.log(`Found: ${relativePath}`);
                }
            }
        }
    }

    if (fs.existsSync(this.repoPath)) {
        scanDir(this.repoPath);
        this.saveFileHashes();
    }
  }

  // Initialize repo if it doesn't exist
  initRepo(createGitignore = false) {
    if (!fs.existsSync(this.repoPath)) {
      fs.mkdirSync(this.repoPath, { recursive: true });
      console.log(`Created repo directory: ${this.repoPath}`);
    }
    this.scanRepo();
    
    if (createGitignore) {
    // create initial .gitignore if it doesn't exist
    const gitignorePath = path.join(this.repoPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const gitignoreContent = `node_modules/
        .env
        .DS_Store
        *.log
        .shadow/
        dist/
        build/
        `;
      fs.writeFileSync(gitignorePath, gitignoreContent);
        console.log(' Created .gitignore');
      }
    }
  }

  // write file and track changes
  writeFile(relativePath, content) {
    const fullPath = path.join(this.repoPath, relativePath);
    const dir = path.dirname(fullPath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Get old hash before writing
    const oldHash = this.getFileHash(fullPath);
    
    // Write the file
    fs.writeFileSync(fullPath, content, 'utf8');
    
    // Get new hash
    const newHash = this.getFileHash(fullPath);
    
    // Track the change
    this.fileHashes.set(relativePath, newHash);
    
    console.log(`Wrote to file: ${relativePath}`);
    
    // Return change info for incremental indexing
    return {
      path: relativePath,
      changed: oldHash !== newHash,
      oldHash,
      newHash,
      action: oldHash ? 'modified' : 'created'
    };
  }

  // delete file and track removal
  deleteFile(relativePath) {
    const fullPath = path.join(this.repoPath, relativePath);
    
    if (fs.existsSync(fullPath)) {
      const oldHash = this.getFileHash(fullPath);
      fs.unlinkSync(fullPath);
      this.fileHashes.delete(relativePath);
      
      console.log(`Deleted file: ${relativePath}`);
      
      return {
        path: relativePath,
        changed: true,
        oldHash,
        newHash: null,
        action: 'deleted'
      };
    }
    
    return null;
  }

    // get list of changed files since last index
  getChangedFiles() {
    const changed = [];
    
    for (const [filePath, storedHash] of this.fileHashes) {
      const currentHash = this.getFileHash(path.join(this.repoPath, filePath));
      
      if (currentHash !== storedHash) {
        changed.push({
          path: filePath,
          oldHash: storedHash,
          newHash: currentHash,
          action: currentHash ? 'modified' : 'deleted'
        });
      }
    }
    
    return changed;
  }

  // Trigger incremental reindexing
  async reindex(changes = null) {
    if (!changes) {
      changes = this.getChangedFiles();
    }
    
    if (changes.length === 0) {
      console.log('✅ No changes detected, skipping reindex');
      return;
    }

    console.log(`🔄 Reindexing ${changes.length} changed files...`);
    
    // Save current hashes
    this.saveFileHashes();
    
    // Run the indexer with force flag to update
    try {
      const indexPath = path.join(__dirname, './test.js');
      const command = `node ${indexPath} ${this.repoPath} --force`;
      
      console.log(`Running: ${command}`);
      const output = execSync(command, { 
        cwd: path.dirname(indexPath),
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('Reindexing complete');
      console.log(output);
      
    } catch (error) {
      console.error(`Reindexing failed: ${error.message}`);
      throw error;
    }
  }

  // Batch write multiple files
  async writeFiles(files) {
    const changes = [];
    
    for (const [filePath, content] of Object.entries(files)) {
      const change = this.writeFile(filePath, content);
      if (change.changed) {
        changes.push(change);
      }
    }
    
    // Reindex if any files changed
    if (changes.length > 0) {
      await this.reindex(changes);
    }
    
    return changes;
  }

  // Get repo status
  getStatus() {
    const changed = this.getChangedFiles();
    return {
      repoPath: this.repoPath,
      totalFiles: this.fileHashes.size,
      changedFiles: changed.length,
      changes: changed
    };
  }
}

module.exports = Writer;