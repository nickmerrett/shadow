# GitHub App Setup Guide

This guide explains how to set up GitHub App integration for full repository access, including private repositories.

## Overview

The application uses two GitHub integrations:
1. **GitHub OAuth** (existing) - For user authentication and profile access
2. **GitHub App** (new) - For repository access and operations

## Why GitHub App?

GitHub OAuth tokens have limited access and only work with public repositories by default. A GitHub App provides:
- Access to private repositories
- Fine-grained permissions
- Better security model
- Organization-wide installation capability

## Setup Steps

### 1. Create a GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in the required information:
   - **App name**: Your app name (e.g., "YourApp CodeAgent")
   - **Homepage URL**: Your application URL
   - **Callback URL**: `http://localhost:3000/api/github/install` (for development)
   - **Webhook URL**: Can be left empty for now
   - **Webhook secret**: Can be left empty for now

### 2. Configure Permissions

Set the following repository permissions:
- **Contents**: Read & Write (to read/write repository files)
- **Metadata**: Read (basic repository info)
- **Pull requests**: Read & Write (if needed)
- **Issues**: Read & Write (if needed)

### 3. Generate Private Key

1. In your GitHub App settings, scroll down to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file

### 4. Environment Variables

Add these environment variables to your `.env` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID="123456"  # Your App ID from GitHub App settings
GITHUB_APP_SLUG="your-app-slug"  # The slug from your app URL
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYour private key content here\n-----END RSA PRIVATE KEY-----"
```

**Note**: For the private key, you can either:
- Use the full key with escaped newlines (as shown above)
- Or use a base64 encoded version of the key

### 5. Update Callback URL

In your GitHub App settings, set the callback URL to:
- Development: `http://localhost:3000/api/github/install`
- Production: `https://yourdomain.com/api/github/install`

## How It Works

### Installation Flow

1. User clicks "Connect GitHub" in the repository selector
2. They're redirected to GitHub to install the app
3. User selects which repositories/organizations to grant access to
4. GitHub redirects back to `/api/github/install` with installation ID
5. The app stores the installation ID in the database
6. User can now access private repositories

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

## Development

### Testing

1. Create a test repository (public or private)
2. Install your GitHub App on your account
3. Test repository access through the application

### Debugging

Check the following if you encounter issues:

1. **App not found**: Verify `GITHUB_APP_ID` and `GITHUB_APP_SLUG`
2. **Permission denied**: Check app permissions and installation
3. **Key errors**: Verify private key format and content
4. **Installation issues**: Check callback URL configuration

## Security Notes

- Private keys should never be committed to version control
- Use environment variables for all sensitive configuration
- Consider using GitHub App permissions sparingly (principle of least privilege)
- Regularly rotate private keys if compromised

## Migration from OAuth-only

If you have existing users with OAuth-only access:
1. They'll see "Connect GitHub" instead of repositories
2. After installing the app, they'll have full access
3. No data migration needed - installation ID is stored alongside existing OAuth data