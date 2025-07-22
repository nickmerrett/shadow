Based on their security post

File Hashing

- Compute hash of file + store in Merkle Tree
- Should be able to determine which files stayed the same quickly

Every 10 minutes, they compare hashes and re-index code if needed. This is a cheap process.

Changes made within those 10 minutes are stored in context.

This is extremely useful for live-coding agents, especially when it needs continual context updates.
This is not optimal for background agents as, in the context of a branch, the agent has full control over the new code written.

New code will only be fixed in the case of a merge conflict if relevant code is changed during the background agent's execution.
