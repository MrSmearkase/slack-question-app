# Multi-Workspace Setup Guide

The app now supports multiple Slack workspaces! Each workspace can install the app independently.

## How It Works

- **App Token (xapp-)**: Shared across all workspaces (set in Railway environment variables)
- **Bot Token (xoxb-)**: Unique per workspace (automatically captured when workspace installs)
- **Signing Secret**: Shared across all workspaces (set in Railway environment variables)

## Setting Up Multi-Workspace Support

### 1. Update Railway Environment Variables

Remove `SLACK_BOT_TOKEN` (no longer needed). Keep only:
- `SLACK_SIGNING_SECRET` (required)
- `SLACK_APP_TOKEN` (required)
- `PORT` (optional, defaults to 3000)

### 2. Update Your Slack App Manifest

1. Go to https://api.slack.com/apps/A0A9N3GQCH4
2. Click **App Manifest**
3. Copy the contents of `manifest.json` and paste it
4. Click **Save Changes**

### 3. Add Redirect URL (Required for Multi-Workspace)

1. Go to **OAuth & Permissions**
2. Under **Redirect URLs**, add:
   ```
   https://slack.com/oauth/v2/authorize
   ```
3. Click **Save URLs**

### 4. Install to Each Workspace

For each workspace you want to add:

1. Go to https://api.slack.com/apps/A0A9N3GQCH4
2. Click **Install to Workspace**
3. Select the workspace from the dropdown
4. Authorize the app
5. The bot token will be automatically captured on first use

### 5. Verify Installation

After installing to a workspace:
1. Go to that workspace in Slack
2. Use `/ask-question` command
3. Check Railway logs - you should see:
   ```
   ✅ New workspace connected: T0A9LLLCW5B
   Bot token stored for workspace T0A9LLLCW5B
   ```

## How Tokens Are Stored

- Tokens are stored in memory (in the `workspaceTokens` Map)
- Each workspace's token is captured automatically on first interaction
- For production, consider using a database to persist tokens

## Backward Compatibility

If you have `SLACK_BOT_TOKEN` set in Railway:
- It will be used for the first workspace that connects
- After that, each workspace needs to install via OAuth
- This allows existing single-workspace setups to continue working

## Troubleshooting

**"No token found for workspace" error:**
- The workspace hasn't been installed yet
- Go to app settings → Install to Workspace → Select the workspace

**Workspace not appearing in install dropdown:**
- Make sure you're signed into that workspace in your browser
- Try using the "Add to Slack" button URL instead

**Token not being captured:**
- Check Railway logs for errors
- Make sure the app is running and connected via Socket Mode
- Try using a command in the workspace to trigger token capture
