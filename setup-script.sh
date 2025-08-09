#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Helper function to ask questions (with default value)
ask() {
    local question="$1"
    local default="$2"
    local answer
    
    if [ -n "$default" ]; then
        echo -n -e "${BLUE}${question}${NC} [${GRAY}${default}${NC}]: " >&2
    else
        echo -n -e "${BLUE}${question}${NC}: " >&2
    fi
    
    read answer
    if [ -z "$answer" ]; then
        echo "$default"
    else
        echo "$answer"
    fi
}

# Helper function to ask for required fields (with no default value)
ask_required() {
    local question="$1"
    local description="$2"
    local value=""
    
    while [ -z "$value" ]; do
        if [ -n "$description" ]; then
            echo -e "\n${YELLOW}${description}${NC}" >&2
        fi
        echo -n -e "${BLUE}${question}${NC}: " >&2
        read value
        if [ -z "$value" ]; then
            echo -e "${RED}[!] This field is required. Please enter a value.${NC}" >&2
        fi
    done
    echo "$value"
}

main() {
    echo -e "${GREEN}Shadow Environment Setup${NC}"
    echo "============================"
    echo
    echo "This script will help you set up your environment variables."
    echo "You'll need to have already created a GitHub App for this project."
    echo "https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app"
    echo

    proceed=$(ask "Ready to proceed? (y/N)" "N")
    if [ "$(echo "$proceed" | tr '[:upper:]' '[:lower:]')" != "y" ]; then
        echo "Setup cancelled."
        exit 0
    fi

    # Database Configuration
    echo -e "\n${GREEN}Database Configuration${NC}"
    echo "****************************************************"
    DATABASE_URL=$(ask "Database URL" "postgres://postgres:@127.0.0.1:5432/shadow_dev")

    # Pinecone Configuration
    echo -e "\n${GREEN}Pinecone Configuration${NC}"
    echo "****************************************************"
    echo "Get your API key from: https://app.pinecone.io/"
    PINECONE_API_KEY=$(ask "Pinecone API Key [If not provided, you will not be able to use indexing]")
    PINECONE_INDEX_NAME=$(ask "Pinecone Index Name " "shadow")

    # GitHub App Configuration
    echo -e "\n${GREEN}GitHub App Configuration${NC}"
    echo "****************************************************"
    echo "You can find these values in your GitHub App settings:"
    echo "https://github.com/settings/apps"
    
    GITHUB_APP_ID=$(ask_required "GitHub App ID")
    GITHUB_APP_SLUG=$(ask_required "GitHub App Slug (the app name in lowercase with hyphens)")
    
    echo
    echo "For the private key, paste the entire contents including the header and footer:"
    echo "Press Enter when done, then Ctrl+D to finish input:"
    GITHUB_PRIVATE_KEY=$(cat)
    
    if [ -z "$GITHUB_PRIVATE_KEY" ]; then
        echo -e "${RED}[!] GitHub Private Key is required.${NC}"
        exit 1
    fi
    
    GITHUB_CLIENT_ID=$(ask_required "GitHub Client ID")
    GITHUB_CLIENT_SECRET=$(ask_required "GitHub Client Secret")
    GITHUB_WEBHOOK_SECRET=$(ask_required "GitHub Webhook Secret")

    # Authentication Configuration
    echo -e "\n${GREEN}Authentication Configuration${NC}"
    echo "****************************************************"
    echo "Generate a random secret for BetterAuth (used for JWT signing):"
    BETTER_AUTH_SECRET=$(ask_required "BetterAuth Secret (generate a random string)")

    # Local Development
    echo -e "\n${GREEN}Local Development${NC}"
    echo "****************************************************"
    echo "Directory where local agent workspaces will be created:"
    WORKSPACE_DIR=$(ask "Workspace Directory (absolute path)" "$(pwd)/shadow-workspace")

    # Server Configuration
    echo -e "\n${GREEN}Server Configuration${NC}"
    echo "****************************************************"
    NEXT_PUBLIC_SERVER_URL=$(ask "Frontend Server URL" "http://localhost:4000")

    # Create server .env.test file
    echo -e "\n${GREEN}Creating server .env.test file...${NC}"
    cat > "apps/server/.env.test" << EOF
DATABASE_URL="${DATABASE_URL}"

PINECONE_API_KEY="${PINECONE_API_KEY}"
PINECONE_INDEX_NAME="${PINECONE_INDEX_NAME}"

GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}

WORKSPACE_DIR=${WORKSPACE_DIR}
EOF

    echo -e "${GREEN} Created apps/server/.env.test${NC}"

    # Create frontend .env.test file
    echo -e "${GREEN}Creating frontend .env.test file...${NC}"
    
    # Escape newlines in private key for proper .env format
    ESCAPED_PRIVATE_KEY=$(echo "$GITHUB_PRIVATE_KEY" | sed ':a;N;$!ba;s/\n/\\n/g')
    
    cat > "apps/frontend/.env.test" << EOF
NEXT_PUBLIC_SERVER_URL="${NEXT_PUBLIC_SERVER_URL}"

BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}

GITHUB_APP_ID=${GITHUB_APP_ID}
GITHUB_APP_SLUG=${GITHUB_APP_SLUG}
GITHUB_PRIVATE_KEY="${ESCAPED_PRIVATE_KEY}"
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}

DATABASE_URL="${DATABASE_URL}"
EOF

    echo -e "${GREEN} Created apps/frontend/.env.test${NC}"

    echo -e "\n${GREEN} Setup Complete!${NC}"
    echo "****************************************************"
    echo "Your environment files have been created:"
    echo "  apps/server/.env.test"
    echo "  apps/frontend/.env.test"
    echo -e "\n${YELLOW} Next Steps:${NC}"
    echo "1. Make sure your PostgreSQL database is running"
    echo "2. Run database migrations: \`npm run generate\` then \`npm run db:push\` in the /packages/db directory"
    echo "3. Start the development servers"
    echo -e "\n${RED} Security Note:${NC}"
    echo "Never commit .env files to version control!"
    echo "They contain sensitive credentials."
}

trap 'echo -e "\n\nSetup cancelled."; exit 130' INT

if [ ! -f "apps/server/.env.template" ] || [ ! -f "apps/frontend/.env.template" ]; then
    echo -e "${RED}[!] Error: .env.template files not found.${NC}"
    echo "Please run this script from the root of the Shadow project."
    exit 1
fi

main