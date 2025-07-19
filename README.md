# Shadow Monorepo

This project uses [Turborepo](https://turborepo.com/docs) to manage its dependencies.

## Apps and Packages

**Apps:**

- `frontend`: Next.js app (UI, chat, terminal, task flows)
- `server`: Node.js backend (orchestrator, API, LLM, sockets)
- `indexing`: Code embedding/indexing tools (Pinecone, chunking, retrieval)

**Packages:**

- `db`: Prisma/Postgres client & schema
- `types`: Shared TypeScript types
- `eslint-config`: Shared lint rules
- `typescript-config`: Shared tsconfig

```
.
├── apps/
│   ├── frontend/
│   └── server/
├── packages/
│   ├── db/
│   ├── eslint-config/
│   ├── types/
│   └── typescript-config/
└── research/
```

## Development

Install dependencies:

```
npm install
```

Fill out environment variables:

**apps/frontend/.env.local**

```
NEXT_PUBLIC_API_URL=localhost:4000
NEXT_PUBLIC_SOCKET_URL=localhost:4001

BETTER_AUTH_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

**apps/server/.env**
Note: The database and direct URL are only needed here if you want to run the terminal agent for local workspace testing. Use the same values as the DB package, see the next section for more details.

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

WORKSPACE_DIR=
DEBUG=

DATABASE_URL=
DIRECT_URL=
```

**packages/db/.env**
Note: the direct URL is for non-pooling connections like when running migrate or studio.

```
DATABASE_URL=
DIRECT_URL=
```

To develop all apps and packages, ensure you have [turbo installed globally](<(https://turborepo.com/docs/getting-started/installation#global-installation)>).

Then run the following command:

```
cd my-turborepo

turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
turbo dev --filter=frontend
```

### Linting and formatting

Ensure you have ESLint and Prettier installed for linting and formatting (and also format on save in VSCode settings). You can run these scripts from the project root:

```
npm run lint

npm run format
```

### Database

Our database is PostgreSQL hosted on [Neon](https://neon.tech/) (for now), might move elsewhere later. We're using [Prisma](https://www.prisma.io/) as our ORM.

To generate types from the schema, run:

```
npm run generate
```

Since we're constantly making schema changes, you can just directly push to the database:

```
npm run db:push
```

We have a seed script at `packages/db/src/seed.ts`. It may be out of date since our app is now mostly integrated and you don't really need synthetic data. If you still do, just check with AI that the data is the correct shape then run:

```
npm run db:seed
```

To run the Prisma Studio GUI, you can run:

```
npm run db:studio
```

### Local Workspace Terminal Agent

The coding agent can be run locally in the terminal for testing on a local workspace.

First, create a local workspace directory, we have a script to make one for you:

```
./create-local-workspace.sh
```

Ensure you set the absolute path of the workspace in the server's .env file:

```
WORKSPACE_DIR=...
```

Then, run the terminal agent:

```
cd apps/server
npm run validate
npm run agent
```
