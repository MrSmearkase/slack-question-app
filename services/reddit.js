const axios = require('axios');

const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_BASE = 'https://www.reddit.com/api/v1';
let accessToken = null;
let tokenExpiry = null;

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

async function getAccessToken() {
  // If we have a valid token, return it
  if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
    return accessToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('⚠️ Reddit credentials not set. Skipping Reddit notifications.');
    return null;
  }

  try {
    // Use application-only OAuth (no user context needed for public data)
    const response = await axios.post(
      `${REDDIT_AUTH_BASE}/access_token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: CLIENT_ID,
          password: CLIENT_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'UnifiedNotificationsApp/1.0'
        }
      }
    );

    accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    tokenExpiry = new Date(Date.now() + (expiresIn - 60) * 1000); // Refresh 1 min early

    return accessToken;
  } catch (error) {
    console.error('Error getting Reddit access token:', error.response?.data || error.message);
    return null;
  }
}

async function getMentions(username) {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    // Reddit doesn't have a direct mentions API, so we'll search for username mentions
    const response = await axios.get(`${REDDIT_API_BASE}/user/${username}/mentioned.json`, {
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': 'UnifiedNotificationsApp/1.0'
      },
      params: {
        limit: 50
      }
    });

    const mentions = response.data.data?.children || [];
    return mentions.map(item => {
      const data = item.data;
      return {
        id: `reddit_mention_${data.id}`,
        source: 'Reddit',
        account: username,
        type: 'mention',
        title: data.title || `Mention in r/${data.subreddit}`,
        content: data.body || data.selftext || '',
        author: data.author,
        authorName: data.author,
        url: `https://reddit.com${data.permalink}`,
        timestamp: new Date(data.created_utc * 1000),
        subreddit: data.subreddit,
        score: data.score
      };
    });
  } catch (error) {
    console.error(`Error fetching Reddit mentions for ${username}:`, error.response?.data || error.message);
    return [];
  }
}

async function getReplies(username) {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    // Get replies to user's comments
    const response = await axios.get(`${REDDIT_API_BASE}/user/${username}/comments.json`, {
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': 'UnifiedNotificationsApp/1.0'
      },
      params: {
        limit: 100
      }
    });

    const comments = response.data.data?.children || [];
    const allReplies = [];

    // For each comment, get its replies
    for (const comment of comments.slice(0, 20)) {
      try {
        const commentId = comment.data.id;
        const repliesResponse = await axios.get(`${REDDIT_API_BASE}/api/morechildren.json`, {
          headers: {
            'Authorization': `bearer ${token}`,
            'User-Agent': 'UnifiedNotificationsApp/1.0'
          },
          params: {
            link_id: `t3_${comment.data.link_id?.split('_')[1]}`,
            children: commentId,
            api_type: 'json'
          }
        });

        // Parse replies from the response
        const replies = repliesResponse.data.json?.data?.things || [];
        replies.forEach(reply => {
          if (reply.kind === 't1' && reply.data.author !== username) {
            allReplies.push({
              id: `reddit_reply_${reply.data.id}`,
              source: 'Reddit',
              account: username,
              type: 'reply',
              title: `Reply to your comment in r/${comment.data.subreddit}`,
              content: reply.data.body,
              author: reply.data.author,
              authorName: reply.data.author,
              url: `https://reddit.com${reply.data.permalink}`,
              timestamp: new Date(reply.data.created_utc * 1000),
              subreddit: comment.data.subreddit,
              score: reply.data.score
            });
          }
        });
      } catch (error) {
        // Continue with next comment
        continue;
      }
    }

    return allReplies;
  } catch (error) {
    console.error(`Error fetching Reddit replies for ${username}:`, error.response?.data || error.message);
    return [];
  }
}

async function getNotifications(username) {
  const [mentions, replies] = await Promise.all([
    getMentions(username),
    getReplies(username)
  ]);

  return [...mentions, ...replies];
}

module.exports = {
  getNotifications
};
