import type { FileNode } from "./file-explorer";

export const mockFileStructure: FileNode[] = [
  {
    name: "src",
    type: "folder",
    path: "/src",
    children: [
      {
        name: "components",
        type: "folder",
        path: "/src/components",
        children: [
          {
            name: "Button.tsx",
            type: "file",
            path: "/src/components/Button.tsx",
            content: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button
      onClick={onClick}
      className={\`btn btn-\${variant}\`}
    >
      {children}
    </button>
  );
};`,
          },
          {
            name: "Header.tsx",
            type: "file",
            path: "/src/components/Header.tsx",
            content: `import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <h1>My App</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
};`,
          },
          {
            name: "Layout.tsx",
            type: "file",
            path: "/src/components/Layout.tsx",
            content: `import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};`,
          },
        ],
      },
      {
        name: "pages",
        type: "folder",
        path: "/src/pages",
        children: [
          {
            name: "index.tsx",
            type: "file",
            path: "/src/pages/index.tsx",
            content: `import React from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/Button';

const HomePage: React.FC = () => {
  return (
    <div>
      <Header />
      <main>
        <h2>Welcome to my app</h2>
        <Button onClick={() => alert('Hello!')}>
          Click me
        </Button>
      </main>
    </div>
  );
};

export default HomePage;`,
          },
          {
            name: "about.tsx",
            type: "file",
            path: "/src/pages/about.tsx",
            content: `import React from 'react';
import { Layout } from '../components/Layout';

const AboutPage: React.FC = () => {
  return (
    <Layout>
      <h1>About Us</h1>
      <p>This is the about page of our application.</p>
    </Layout>
  );
};

export default AboutPage;`,
          },
        ],
      },
      {
        name: "utils",
        type: "folder",
        path: "/src/utils",
        children: [
          {
            name: "helpers.ts",
            type: "file",
            path: "/src/utils/helpers.ts",
            content: `export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};`,
          },
          {
            name: "api.ts",
            type: "file",
            path: "/src/utils/api.ts",
            content: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },
};`,
          },
        ],
      },
    ],
  },
  {
    name: "package.json",
    type: "file",
    path: "/package.json",
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "typescript": "^5.0.0"
  }
}`,
  },
  {
    name: "README.md",
    type: "file",
    path: "/README.md",
    content: `# My App

A modern React application built with Next.js.

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- Modern React with TypeScript
- Responsive design
- Component library
- Utility functions

## Project Structure

\`\`\`
src/
├── components/     # Reusable UI components
├── pages/         # Application pages
└── utils/         # Utility functions
\`\`\`
`,
  },
  {
    name: ".gitignore",
    type: "file",
    path: "/.gitignore",
    content: `# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel
`,
  },
];
