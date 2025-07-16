# Shadow Coding Agent - Local Mode

A powerful AI coding assistant that can understand, modify, and work with codebases using a comprehensive set of tools.

## Features

- 🤖 **AI-Powered**: Uses Claude 3.5 Sonnet or other advanced models
- 🛠️ **Rich Toolset**: File operations, terminal commands, code search, and more
- 💬 **Interactive CLI**: Easy-to-use command-line interface
- 🔒 **Safe Execution**: Optional approval workflow for terminal commands
- 📝 **Persistent History**: Conversation and task history stored in database
- 🚀 **Streaming Output**: Real-time response streaming

## Prerequisites

Before running the coding agent, ensure you have:

1. **Node.js** (v18 or later)
2. **PostgreSQL** database running
3. **ripgrep** (`rg`) command-line tool for fast text searching
4. **API Key** from either Anthropic or OpenAI

### Installing Prerequisites

#### ripgrep
```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt install ripgrep

# CentOS/RHEL
sudo yum install ripgrep

# Windows
choco install ripgrep
```

#### PostgreSQL
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb shadow
```

## Setup

1. **Clone and install dependencies**:
   ```bash
   cd apps/server
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database URL
   ```

3. **Set up the database**:
   ```bash
   # From the root of the project
   cd packages/db
   npx prisma generate
   npx prisma db push
   ```

4. **Ensure workspace directory exists**:
   ```bash
   mkdir -p /workspace
   # Or set WORKSPACE_DIR in .env to your preferred location
   ```

## Usage

### Starting the Agent

```bash
# Basic usage
npm run agent

# With specific model
npm run agent -- --model claude-3-5-sonnet-20241022

# With custom task ID
npm run agent -- --task-id my-coding-task

# Show help
npm run agent -- --help
```

### Interactive Commands

Once the agent is running, you can use these commands:

- `/help` - Show available commands and capabilities
- `/model` - Change the AI model
- `/history` - View conversation history
- `/clear` - Start a new conversation
- `/exit` - Exit the agent

### Example Interactions

```
> Create a new React component for a login form

> Fix the authentication bug in src/auth/login.ts

> Add unit tests for the user service

> Refactor the database connection to use connection pooling

> Set up a new Express.js API with TypeScript
```

## Tool Capabilities

The coding agent has access to these tools:

### File Operations
- **read_file**: Read file contents with line range support
- **edit_file**: Create new files or edit existing ones
- **search_replace**: Precise find-and-replace operations
- **delete_file**: Safe file deletion

### Code Analysis
- **codebase_search**: Semantic search through code
- **grep_search**: Fast regex-based text search
- **file_search**: Find files by name pattern

### System Operations
- **run_terminal_cmd**: Execute shell commands
- **list_dir**: Browse directory contents

### Terminal Command Approval

By default, terminal commands run automatically. To require approval:

1. Edit `src/tools/index.ts`
2. Change `REQUIRE_TERMINAL_APPROVAL` to `true`
3. Restart the agent

When enabled, the agent will ask for permission before running each command.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key | One of the API keys |
| `OPENAI_API_KEY` | OpenAI API key | One of the API keys |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `WORKSPACE_DIR` | Working directory path | No (default: `/workspace`) |
| `PORT` | Server port | No (default: `3001`) |
| `NODE_ENV` | Environment mode | No (default: `development`) |

### Available Models

- **claude-3-5-sonnet-20241022** (default) - Most capable for complex reasoning
- **claude-3-5-haiku-20241022** - Faster and more cost-effective
- **gpt-4o** - OpenAI's most advanced model
- **gpt-4o-mini** - OpenAI's cost-efficient model

## Architecture

The coding agent consists of several components:

- **ChatService**: Manages conversations and message history
- **LLMService**: Handles AI model interactions with tool support
- **Tools**: Individual tool implementations for various operations
- **LocalCodingAgent**: CLI interface and user interaction
- **Database**: PostgreSQL for persistent storage

## Troubleshooting

### Common Issues

1. **"ripgrep not found"**
   - Install `ripgrep` using your package manager
   - Ensure `rg` command is in your PATH

2. **Database connection errors**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env
   - Run `npx prisma db push` to ensure schema is up to date

3. **API key errors**
   - Verify your API key is correct in .env
   - Check that you have sufficient credits/quota
   - Ensure the model you're trying to use matches your API provider

4. **Permission denied errors**
   - Ensure the workspace directory is writable
   - Check file permissions in your working directory

### Debug Mode

Enable detailed logging by setting `DEBUG=true` in your .env file.

## Contributing

This is part of the Shadow project. See the main project README for contribution guidelines.

## License

See the main project LICENSE file.