# GitHub App Setup Guide

This guide explains how to set up GitHub App integration for both user authentication AND repository access.

## Overview

The application uses **one GitHub App** for two purposes:

1. **User Authentication** - OAuth-like flow for signing in users
2. **Repository Access** - Installation flow for accessing private repos

## Why One GitHub App for Both?

GitHub Apps can handle both user authentication (like OAuth) and repository installation. This is more secure and efficient than managing separate apps.

## Setup Steps

### 1. Create a GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in the required information:
   - **App name**: Your app name (e.g., "YourApp CodeAgent")
   - **Homepage URL**: Your application URL
   - **User authorization callback URL**: `http://localhost:3000/api/auth/callback/github` (for better-auth)
   - **Setup URL**: `http://localhost:3000/api/github/install` (for installation)
   - **Webhook URL**: Can be left empty for now
   - **Webhook secret**: Can be left empty for now

### 2. Configure Permissions

Set the following repository permissions:

- **Contents**: Read & Write (to read/write repository files)
- **Metadata**: Read (basic repository info)
- **Pull requests**: Read & Write (if needed)
- **Issues**: Read & Write (if needed)

**Important**: Also check "Request user authorization (OAuth) during installation" if you want users to authenticate when they install.

### 3. Generate Private Key

1. In your GitHub App settings, scroll down to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file

### 4. Environment Variables

Add these environment variables to your `.env` file:

```bash
# GitHub App Configuration (for both auth and repo access)
GITHUB_CLIENT_ID="Iv1.your-client-id"  # From GitHub App settings
GITHUB_CLIENT_SECRET="your-client-secret"  # From GitHub App settings
GITHUB_APP_ID="123456"  # Your App ID from GitHub App settings
GITHUB_APP_SLUG="your-app-slug"  # The slug from your app URL
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYour private key content here\n-----END RSA PRIVATE KEY-----"
```

**Key Points**:

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are used by better-auth for user authentication
- `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` are used for repository access
- These all come from the **same GitHub App**

### 5. Update Callback URLs

In your GitHub App settings:

- **User authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
- **Setup URL**: `http://localhost:3000/api/github/install`

For production:

- **User authorization callback URL**: `https://yourdomain.com/api/auth/callback/github`
- **Setup URL**: `https://yourdomain.com/api/github/install`

## How It Works

### Two-Step User Flow

1. **Step 1: User Authentication** (via better-auth)
   - User clicks "Sign in with GitHub"
   - Redirected to GitHub OAuth flow
   - GitHub redirects to `/api/auth/callback/github`
   - User is now signed in

2. **Step 2: Repository Access** (via app installation)
   - User tries to access repositories
   - System detects GitHub App not installed
   - Shows "Connect GitHub" button
   - Redirects to GitHub App installation page
   - User selects repos/orgs to grant access to
   - GitHub redirects to `/api/github/install`
   - Installation ID is stored, user can now access private repos

### API Changes

The repository and branch fetching APIs now:

1. Check if the GitHub App is installed
2. Use installation tokens instead of OAuth tokens
3. Access repositories through the GitHub App's permissions

### Frontend Changes

The GitHub repository selector now:

1. Checks GitHub App installation status
2. Shows "Connect GitHub" when app is not installed
3. Redirects to GitHub App installation when needed
4. Automatically refreshes after successful installation

## Common Issues & Solutions

### Issue: Installation redirects to auth callback instead of install callback

**Problem**: You have the Setup URL configured incorrectly or missing.

**Solution**:

1. Go to your GitHub App settings
2. Set **Setup URL** to `http://localhost:3000/api/github/install`
3. Make sure **User authorization callback URL** is set to `http://localhost:3000/api/auth/callback/github`

### Issue: Users see OAuth authorization when installing

**Solution**: This is normal! GitHub Apps can optionally request user authorization during installation. You can disable this in your GitHub App settings if you don't want it.

### Issue: "App not found" errors

**Solution**: Verify all environment variables are set correctly:

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (for auth)
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and `GITHUB_PRIVATE_KEY` (for installation)

## Development

### Testing

1. Sign in with GitHub (should work with existing OAuth flow)
2. Try to access repositories → should show "Connect GitHub"
3. Click "Connect GitHub" → should redirect to app installation
4. Install app on a test repository
5. Return to app → should now show repositories including private ones

### Debugging

1. **Auth not working**: Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
2. **Installation not working**: Check `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY`
3. **Wrong redirect**: Check Setup URL vs User authorization callback URL
4. **No repos showing**: Check app permissions and installation scope

## Security Notes

- All credentials come from the same GitHub App
- Private keys should never be committed to version control
- Use environment variables for all sensitive configuration
- Installation tokens are short-lived (1 hour) for security

## Migration from Separate OAuth

If you previously had a separate OAuth app:

1. Update `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to use your GitHub App's credentials
2. Add the new GitHub App environment variables
3. Users will need to go through the installation flow once
4. No data migration needed
