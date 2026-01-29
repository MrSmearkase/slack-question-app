# Railway Deployment Guide

## Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with your GitHub account (recommended) or email
3. Complete the signup process

## Step 2: Create New Project

1. Click "New Project" in Railway dashboard
2. Select "Deploy from GitHub repo"
3. Choose your repository: `MrSmearkase/slack-question-app`
4. Railway will automatically detect it's a Node.js app

## Step 3: Configure Environment Variables

In Railway dashboard, go to your project → Variables tab, and add:

```
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
PORT=3000
```

**Important:** Get these values from:
- `SLACK_BOT_TOKEN`: OAuth & Permissions → Bot User OAuth Token
- `SLACK_SIGNING_SECRET`: Basic Information → App Credentials → Signing Secret
- `SLACK_APP_TOKEN`: Socket Mode → App-Level Token

## Step 4: Deploy

1. Railway will automatically deploy when you connect the repo
2. Check the "Deployments" tab to see the build progress
3. Once deployed, check the "Logs" tab to see if the app started successfully

## Step 5: Verify It's Running

1. Check the logs in Railway - you should see:
   - `Starting Slack app...`
   - `✅ App authenticated as: anonymous_q_and_a_bot`
   - `⚡️ Slack app is running on port 3000!`
   - `[INFO] socket-mode:SocketModeClient:0 Now connected to Slack`

2. Test in Slack by using `/ask-question`

## Notes

- Railway will keep your app running 24/7
- The app will automatically restart if it crashes
- You can view logs in real-time in the Railway dashboard
- Railway provides a free tier with $5 credit monthly

## Troubleshooting

- **App not connecting**: Check that all environment variables are set correctly
- **Build fails**: Make sure `package.json` has the correct dependencies
- **App crashes**: Check the logs tab for error messages
