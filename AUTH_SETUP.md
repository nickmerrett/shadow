# GitHub OAuth Authentication Setup

This guide explains how to set up GitHub OAuth authentication for the Shadow project using better-auth.

## Prerequisites

- GitHub account
- PostgreSQL database

## 1. Create GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Shadow (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3001/api/auth/callback/github`
4. Click "Register application"
5. Note down the `Client ID` and generate a `Client Secret`

## 2. Environment Variables

### Server (.env)
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/shadow_db"
DIRECT_URL="postgresql://user:password@localhost:5432/shadow_db"

# Better Auth
BETTER_AUTH_SECRET="your-32-character-secret-key-here"
BETTER_AUTH_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## 3. Database Migration

Run Prisma migration to create the auth tables:

```bash
cd packages/db
npx prisma migrate dev --name add-auth-tables
npx prisma generate
```

## 4. Install Dependencies

```bash
# Root
npm install

# Or install individually
cd apps/server && npm install
cd apps/frontend && npm install
```

## 5. Start the Application

```bash
# Start server (from apps/server)
npm run dev

# Start frontend (from apps/frontend) 
npm run dev
```

## How It Works

1. **Protected Routes**: All routes except `/auth` require authentication
2. **Sign In**: Users click "Sign in with GitHub" on `/auth` page
3. **OAuth Flow**: Redirected to GitHub, then back to the app
4. **Session Management**: better-auth handles sessions with secure cookies
5. **User Menu**: Authenticated users see profile menu with logout option

## Files Created/Modified

- `packages/db/prisma/schema.prisma` - Added auth tables
- `apps/server/src/auth.ts` - Better-auth configuration
- `apps/server/src/app.ts` - Auth routes integration
- `apps/frontend/lib/auth-client.ts` - Frontend auth client
- `apps/frontend/middleware.ts` - Route protection
- `apps/frontend/app/auth/page.tsx` - Sign-in page
- `apps/frontend/components/auth/` - Auth components
- `apps/frontend/app/layout.tsx` - Session provider integration

## Troubleshooting

- **Redirect URI mismatch**: Ensure GitHub OAuth app callback URL matches `BETTER_AUTH_URL/api/auth/callback/github`
- **CORS issues**: Check that `FRONTEND_URL` is correctly set and matches the frontend domain
- **Session not persisting**: Verify `BETTER_AUTH_SECRET` is set and is at least 32 characters