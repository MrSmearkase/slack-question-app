const express = require('express');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const twitterService = require('./services/twitter');
const redditService = require('./services/reddit');
const instagramService = require('./services/instagram');
const chessService = require('./services/chess');
const notificationAggregator = require('./services/aggregator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store notifications in memory (in production, use a database)
let notifications = [];
let lastFetchTime = new Date();

// Track fetch errors
const fetchErrors = {
  twitter: null,
  reddit: null,
  instagram: null,
  chess: null
};

// Fetch notifications from all sources
async function fetchAllNotifications() {
  console.log('🔄 Fetching notifications from all sources...');
  const allNotifications = [];

  try {
    // Twitter @Sam_Copeland
    try {
      const twitter1 = await twitterService.getNotifications('Sam_Copeland');
      allNotifications.push(...twitter1);
      fetchErrors.twitter = null;
    } catch (error) {
      console.error('Error fetching Twitter @Sam_Copeland:', error.message);
      fetchErrors.twitter = error.message;
    }

    // Twitter samcopelandchess
    try {
      const twitter2 = await twitterService.getNotifications('samcopelandchess');
      allNotifications.push(...twitter2);
    } catch (error) {
      console.error('Error fetching Twitter samcopelandchess:', error.message);
    }

    // Reddit
    try {
      const reddit = await redditService.getNotifications('SamSCopeland');
      allNotifications.push(...reddit);
      fetchErrors.reddit = null;
    } catch (error) {
      console.error('Error fetching Reddit:', error.message);
      fetchErrors.reddit = error.message;
    }

    // Instagram
    try {
      const instagram = await instagramService.getNotifications('sam_copeland');
      allNotifications.push(...instagram);
      fetchErrors.instagram = null;
    } catch (error) {
      console.error('Error fetching Instagram:', error.message);
      fetchErrors.instagram = error.message;
    }

    // Chess.com
    try {
      const chess = await chessService.getNotifications();
      allNotifications.push(...chess);
      fetchErrors.chess = null;
    } catch (error) {
      console.error('Error fetching Chess.com:', error.message);
      fetchErrors.chess = error.message;
    }

    // Merge with existing notifications, avoiding duplicates
    const existingIds = new Set(notifications.map(n => n.id));
    const newNotifications = allNotifications.filter(n => !existingIds.has(n.id));
    
    notifications = [...newNotifications, ...notifications]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 1000); // Keep last 1000 notifications

    lastFetchTime = new Date();
    console.log(`✅ Fetched ${newNotifications.length} new notifications. Total: ${notifications.length}`);
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
  }
}

// API Routes
app.get('/api/notifications', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const source = req.query.source;
  const type = req.query.type;

  let filtered = notifications;

  if (source) {
    filtered = filtered.filter(n => n.source === source);
  }

  if (type) {
    filtered = filtered.filter(n => n.type === type);
  }

  const paginated = filtered.slice(offset, offset + limit);

  res.json({
    notifications: paginated,
    total: filtered.length,
    lastFetch: lastFetchTime
  });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    total: notifications.length,
    bySource: {},
    byType: {},
    lastFetch: lastFetchTime,
    errors: fetchErrors
  };

  notifications.forEach(n => {
    stats.bySource[n.source] = (stats.bySource[n.source] || 0) + 1;
    stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
  });

  res.json(stats);
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initial fetch on startup
fetchAllNotifications();

// Schedule periodic fetches (every 5 minutes)
cron.schedule('*/5 * * * *', () => {
  fetchAllNotifications();
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Unified Notifications App running on http://localhost:${PORT}`);
  console.log(`📊 Fetching notifications every 5 minutes...`);
});
