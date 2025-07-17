# GitHub OAuth Authentication Setup

This guide explains how to set up GitHub OAuth authentication for the Shadow project using better-auth with Next.js API routes (frontend-only approach).

## Prerequisites

- GitHub account
- PostgreSQL database

## 1. Create GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Shadow (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Note down the `Client ID` and generate a `Client Secret`

## 2. Environment Variables

### Frontend (.env.local)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/shadow_db"

# Better Auth
BETTER_AUTH_SECRET="your-32-character-secret-key-here"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
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

# Or install frontend dependencies
cd apps/frontend && npm install
```

## 5. Start the Application

```bash
# Start frontend (which now includes auth API routes)
cd apps/frontend
npm run dev
```

## How It Works

1. **Protected Routes**: All routes except `/auth` and `/api/*` require authentication
2. **Sign In**: Users click "Sign in with GitHub" on `/auth` page
3. **OAuth Flow**: Redirected to GitHub, then back to Next.js API routes
4. **Session Management**: better-auth handles sessions with secure cookies
5. **User Menu**: Authenticated users see profile menu with logout option

## Files Created/Modified

- `packages/db/prisma/schema.prisma` - Added auth tables
- `apps/frontend/app/api/auth/[...auth]/route.ts` - Better-auth API route handler
- `apps/frontend/lib/auth-client.ts` - Frontend auth client
- `apps/frontend/middleware.ts` - Route protection
- `apps/frontend/app/auth/page.tsx` - Sign-in page
- `apps/frontend/components/auth/` - Auth components
- `apps/frontend/app/layout.tsx` - Session provider integration

## Troubleshooting

- **Redirect URI mismatch**: Ensure GitHub OAuth app callback URL matches `http://localhost:3000/api/auth/callback/github`
- **Import errors**: Ensure `@repo/db` workspace dependency is properly configured
- **Session not persisting**: Verify `BETTER_AUTH_SECRET` is set and is at least 32 characters
- **Cookie issues**: Clear browser cookies and restart the dev server
- **Database errors**: Run `npm run db:migrate:dev` to apply schema changes
