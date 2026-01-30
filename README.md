# Anonymous Q and A Bot

A Slack app that allows users to post questions and collect anonymous responses with voting functionality. Supports multiple workspaces and is ready for Slack App Directory submission!

## Features

- **Post Questions**: Use `/ask-question` command to post a question to any channel
- **Anonymous Responses**: Users can click a button to respond anonymously via a modal
- **Threaded Responses**: All responses appear in a thread under the original question
- **Voting System**: Users can upvote/downvote responses using thumbs up/down emoji reactions
- **Point Tracking**: Responses automatically display their point total (upvotes - downvotes)
- **Close Voting**: Question posters can close voting and announce the winning response
- **Multi-Workspace Support**: Install the app to multiple Slack workspaces

## Setup Instructions

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch" or use the manifest
3. Name your app and select your workspace
4. Click "Create App"

### 2. Configure OAuth & Permissions

1. In the sidebar, go to **OAuth & Permissions**
2. Under **Scopes** → **Bot Token Scopes**, add the following:
   - `chat:write` - Post messages
   - `chat:write.public` - Post messages in channels the app isn't in
   - `commands` - Use slash commands
   - `reactions:read` - Read reactions
   - `reactions:write` - Add reactions
   - `channels:read` - View basic channel information
   - `groups:read` - View basic private channel information
   - `im:read` - View basic direct message information
   - `mpim:read` - View basic group direct message information

3. Under **Redirect URLs**, add:
   ```
   https://slack.com/oauth/v2/authorize
   ```

4. Scroll up and click **Install to Workspace**
5. Authorize the app and copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 3. Enable Socket Mode

1. In the sidebar, go to **Socket Mode**
2. Toggle **Enable Socket Mode** to ON
3. Click **Create Token** → Name it (e.g., "Socket Token")
4. Select scope: `connections:write`
5. Copy the **App-Level Token** (starts with `xapp-`)

### 4. Create Slash Command

1. In the sidebar, go to **Slash Commands**
2. Click **Create New Command**
3. Configure:
   - **Command**: `/ask-question`
   - **Request URL**: (leave empty for Socket Mode)
   - **Short Description**: Post a question to the channel
   - **Usage Hint**: `What is your question?`
4. Click **Save**

### 5. Subscribe to Events

1. In the sidebar, go to **Event Subscriptions**
2. Toggle **Enable Events** to ON
3. Under **Subscribe to bot events**, add:
   - `reaction_added`
   - `reaction_removed`
4. Click **Save Changes**

### 6. Enable Distribution (for Multi-Workspace)

1. In the sidebar, go to **Manage Distribution**
2. Under **Share Your App**, create a **Shareable Link**
3. Use this link to install the app to additional workspaces

### 7. Install Dependencies

```bash
npm install
```

### 8. Configure Environment Variables

Create a `.env` file in the project root:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
PORT=3000
```

You can find your **Signing Secret** in **Basic Information** → **App Credentials**.

**Note**: For multi-workspace support, `SLACK_BOT_TOKEN` is optional - tokens are captured automatically per workspace.

### 9. Run the App

```bash
npm start
```

## Usage

### Posting a Question

In any Slack channel, type:
```
/ask-question What is the best programming language?
```

The app will post a message with a "Respond" button.

### Responding to Questions

1. Click the **Respond** button on any question
2. Enter your response in the modal that appears
3. Click **Submit**
4. Your response will be posted anonymously in a thread with 👍 and 👎 reactions

### Voting on Responses

1. Click the 👍 (thumbs up) reaction to upvote a response
2. Click the 👎 (thumbs down) reaction to downvote a response
3. The response will automatically update to show the point total

### Closing Voting

1. Click the **Close Voting** button on your question
2. The app will announce the response with the most votes
3. New responses will be disabled

## Multi-Workspace Support

The app supports multiple Slack workspaces:

- Each workspace gets its own bot token (automatically captured)
- Questions and responses are tracked separately per workspace
- Install the app to each workspace using the shareable link from **Manage Distribution**

See `MULTI_WORKSPACE_SETUP.md` for detailed instructions.

## Deployment

See `RAILWAY_SETUP.md` for instructions on deploying to Railway or other cloud platforms.

## Database Setup

The app now supports PostgreSQL for persistent data storage! All data (questions, responses, votes, and workspace tokens) is stored in the database with encryption for sensitive tokens.

See `DATABASE_SETUP.md` for detailed database setup instructions.

**Quick Start:**
1. Add PostgreSQL service in Railway
2. Set `DATABASE_URL` (automatically set by Railway)
3. Set `ENCRYPTION_KEY` (generate a random 32-byte hex string)
4. Deploy - tables are created automatically!

## Notes

- **Database Storage**: All data is stored in PostgreSQL (if `DATABASE_URL` is set)
- **Fallback Mode**: If no database, app uses in-memory storage (data lost on restart)
- **Encryption**: Workspace tokens are encrypted before storage
- **Socket Mode**: The app uses Socket Mode, so it doesn't require a public URL
- **Anonymous Responses**: All responses are posted anonymously - the original responder is not identified

## Troubleshooting

- **App not responding**: Check that Socket Mode is enabled and the app token is correct
- **Commands not working**: Ensure the slash command is installed in your workspace
- **Reactions not updating points**: Verify that `reaction_added` and `reaction_removed` events are subscribed
- **"dispatch_failed" error**: Make sure `SLACK_BOT_TOKEN` is set for the first workspace, or install the app via OAuth
- **"invalid_team_for_non_distributed_app"**: Enable distribution in **Manage Distribution** → **Share Your App**
