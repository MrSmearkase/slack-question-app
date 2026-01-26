# Unified Notifications App

A unified notifications aggregator that collects notifications from Twitter, Reddit, Instagram, and Chess.com into a single, beautiful feed.

## Features

- **Twitter Integration**: Fetches replies, likes, and mentions from multiple Twitter accounts
- **Reddit Integration**: Monitors replies and mentions on your Reddit account
- **Instagram Integration**: Tracks comments and likes on your Instagram posts
- **Chess.com Integration**: Monitors comments on specified articles and forum threads
- **Beautiful Web Interface**: Modern, responsive UI with filtering and real-time updates
- **Auto-refresh**: Automatically fetches new notifications every 5 minutes

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Credentials

Create a `.env` file in the project root with your API credentials:

```env
# Twitter API (X API v2)
# Get your Bearer Token from https://developer.twitter.com/en/portal/dashboard
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Reddit API
# Create an app at https://www.reddit.com/prefs/apps
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USERNAME=SamSCopeland
REDDIT_PASSWORD=your_reddit_password

# Instagram Graph API
# Create an app at https://developers.facebook.com/apps/
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_USER_ID=your_instagram_user_id

# Chess.com (optional - comma-separated URLs)
CHESS_COM_ARTICLES=https://www.chess.com/article1,https://www.chess.com/article2
CHESS_COM_FORUMS=https://www.chess.com/forum/view/general/thread1

# Server
PORT=3000
```

### 3. Get API Credentials

#### Twitter/X API
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or use an existing one
3. Generate a Bearer Token
4. Add it to your `.env` file

#### Reddit API
1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click "Create App" or "Create Another App"
3. Choose "script" as the app type
4. Copy the client ID (under the app name) and secret
5. Add them to your `.env` file along with your Reddit username and password

#### Instagram Graph API
1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Create a new app
3. Add Instagram Basic Display product
4. Follow the setup process to get an access token
5. Get your Instagram User ID from the API
6. Add both to your `.env` file

#### Chess.com
- Currently, Chess.com doesn't have a public API for comments
- You can add article and forum URLs to monitor (comma-separated)
- Full implementation would require web scraping (not included for legal/compliance reasons)

### 4. Run the App

```bash
npm start
```

The app will be available at `http://localhost:3000`

## Usage

1. **View All Notifications**: Open the app in your browser to see all notifications from all sources
2. **Filter by Source**: Use the "All Sources" dropdown to filter by Twitter, Reddit, Instagram, or Chess.com
3. **Filter by Type**: Filter by mentions, replies, comments, or likes
4. **Auto-refresh**: The app automatically fetches new notifications every 5 minutes
5. **Manual Refresh**: Click the "Refresh" button to manually fetch new notifications

## API Endpoints

- `GET /` - Main web interface
- `GET /api/notifications` - Get notifications (supports `?source=`, `?type=`, `?limit=`, `?offset=`)
- `GET /api/stats` - Get statistics about notifications

## Account Configuration

The app is configured to monitor:
- **Twitter**: @Sam_Copeland and @samcopelandchess
- **Reddit**: u/SamSCopeland
- **Instagram**: sam_copeland
- **Chess.com**: Articles and forums specified in `.env`

## Limitations

1. **Twitter Likes**: Twitter API v2 doesn't provide direct access to who liked your tweets. Only like counts are available.
2. **Instagram Likes**: Instagram Graph API provides total like counts but not individual like notifications.
3. **Chess.com**: Chess.com doesn't have a public API for comments. Full implementation would require web scraping.
4. **Rate Limits**: Each API has rate limits. The app fetches every 5 minutes to stay within limits.

## Troubleshooting

- **No notifications appearing**: Check that your API credentials are correct and that the accounts exist
- **Twitter errors**: Ensure your Bearer Token has the correct permissions (read access)
- **Reddit errors**: Verify your app credentials and that you're using a "script" type app
- **Instagram errors**: Make sure your access token hasn't expired and has the correct permissions

## Notes

- Notifications are stored in memory. For production use, consider using a database (PostgreSQL, MongoDB, etc.)
- The app fetches notifications every 5 minutes. Adjust the cron schedule in `app.js` if needed
- Some APIs may require additional setup or approval processes
