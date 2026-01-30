# Database Setup Guide

This app now uses PostgreSQL for persistent data storage. All data (questions, responses, votes, and workspace tokens) is stored in the database and encrypted where appropriate.

## Quick Setup: Railway PostgreSQL

### Step 1: Add PostgreSQL to Railway

1. Go to your Railway project dashboard
2. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically:
   - Create a PostgreSQL database
   - Set the `DATABASE_URL` environment variable
   - Provide connection credentials

### Step 2: Set Encryption Key (Optional but Recommended)

1. In Railway → Your Project → **Variables** tab
2. Add a new variable:
   ```
   ENCRYPTION_KEY=<generate-a-random-32-byte-hex-string>
   ```
3. To generate a key, you can use:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Or use an online generator: https://www.random.org/strings/

**Note**: If `ENCRYPTION_KEY` is not set, a random key will be generated on startup. However, this means tokens will be encrypted with a different key each time the app restarts, making them unreadable. **Always set ENCRYPTION_KEY in production!**

### Step 3: Deploy

1. Railway will automatically detect the `DATABASE_URL` and deploy
2. The app will:
   - Connect to the database
   - Create all necessary tables
   - Load existing workspace tokens
   - Start accepting connections

### Step 4: Verify

Check Railway logs - you should see:
```
📦 Connecting to database...
✅ Database connection successful
✅ Database tables initialized successfully
✅ Loaded X workspace token(s) from database
```

## Manual Setup (Other Platforms)

### Step 1: Create PostgreSQL Database

Use any PostgreSQL provider:
- **Railway** (recommended - free tier available)
- **Heroku Postgres**
- **AWS RDS**
- **Google Cloud SQL**
- **DigitalOcean Managed Databases**
- **Supabase** (free tier available)
- **Neon** (free tier available)

### Step 2: Get Connection String

Your database provider will give you a connection string like:
```
postgresql://user:password@host:port/database?sslmode=require
```

### Step 3: Set Environment Variables

Set these in your hosting platform:
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
ENCRYPTION_KEY=<your-32-byte-hex-key>
```

### Step 4: Deploy

The app will automatically:
- Connect to the database
- Create tables on first run
- Start working

## Database Schema

The app creates these tables:

### `workspace_tokens`
- Stores encrypted bot tokens for each workspace
- Columns: `team_id`, `bot_token` (encrypted), `created_at`, `updated_at`

### `questions`
- Stores all questions posted
- Columns: `question_id`, `team_id`, `question_text`, `channel_id`, `message_ts`, `user_id`, `voting_closed`, `created_at`

### `responses`
- Stores all anonymous responses
- Columns: `response_id`, `question_id`, `response_text`, `message_ts`, `created_at`

### `votes`
- Stores all upvotes and downvotes
- Columns: `vote_id`, `response_id`, `user_id`, `vote_type` ('upvote' or 'downvote'), `created_at`

## Security Features

1. **Encrypted Tokens**: Bot tokens are encrypted using AES-256-CBC before storage
2. **SSL Connections**: Database connections use SSL when available
3. **Environment Variables**: All sensitive data stored in environment variables
4. **No Plain Text**: Tokens never logged or exposed in plain text

## Fallback Mode

If `DATABASE_URL` is not set, the app will:
- Continue to work using in-memory storage
- Show a warning in logs
- **Data will be lost on restart**

This allows the app to work during development or if database setup is delayed.

## Troubleshooting

### "Database connection failed"
- Check that `DATABASE_URL` is set correctly
- Verify database is accessible from your hosting platform
- Check firewall/network settings

### "Tokens not persisting"
- Ensure `ENCRYPTION_KEY` is set and consistent across restarts
- Check database connection is working
- Verify tables were created (check Railway database dashboard)

### "Tables not created"
- Check database permissions
- Verify connection string is correct
- Check logs for specific error messages

## Backup Recommendations

1. **Regular Backups**: Use your database provider's backup feature
2. **Export Data**: Periodically export workspace tokens (encrypted)
3. **Monitor**: Set up alerts for database connection issues

## Migration from In-Memory Storage

If you were using the app before database support:
1. Add PostgreSQL service
2. Set `DATABASE_URL`
3. Deploy - the app will create tables automatically
4. Existing in-memory data will be lost (this is expected)
5. New data will be stored in the database going forward
