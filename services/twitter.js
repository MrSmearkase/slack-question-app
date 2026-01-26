const axios = require('axios');

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

async function getUserId(username) {
  try {
    const response = await axios.get(`${TWITTER_API_BASE}/users/by/username/${username}`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`
      }
    });
    return response.data.data.id;
  } catch (error) {
    console.error(`Error fetching Twitter user ID for ${username}:`, error.response?.data || error.message);
    return null;
  }
}

async function getMentions(userId, username) {
  try {
    const response = await axios.get(`${TWITTER_API_BASE}/users/${userId}/mentions`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`
      },
      params: {
        max_results: 50,
        'tweet.fields': 'created_at,author_id,public_metrics,text',
        'user.fields': 'username,name,profile_image_url',
        expansions: 'author_id'
      }
    });

    const mentions = response.data.data || [];
    const users = (response.data.includes?.users || []).reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    return mentions.map(tweet => ({
      id: `twitter_${username}_mention_${tweet.id}`,
      source: 'Twitter',
      account: username,
      type: 'mention',
      title: `Mention from @${users[tweet.author_id]?.username || 'unknown'}`,
      content: tweet.text,
      author: users[tweet.author_id]?.username || 'unknown',
      authorName: users[tweet.author_id]?.name || 'Unknown',
      authorAvatar: users[tweet.author_id]?.profile_image_url,
      url: `https://twitter.com/${users[tweet.author_id]?.username || 'unknown'}/status/${tweet.id}`,
      timestamp: new Date(tweet.created_at),
      metrics: tweet.public_metrics
    }));
  } catch (error) {
    console.error(`Error fetching Twitter mentions for ${username}:`, error.response?.data || error.message);
    return [];
  }
}

async function getReplies(userId, username) {
  try {
    // Get user's recent tweets to find replies
    const tweetsResponse = await axios.get(`${TWITTER_API_BASE}/users/${userId}/tweets`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`
      },
      params: {
        max_results: 10,
        'tweet.fields': 'created_at,conversation_id,public_metrics'
      }
    });

    const conversationIds = [...new Set((tweetsResponse.data.data || []).map(t => t.conversation_id))];
    const allReplies = [];

    // For each conversation, get replies
    for (const convId of conversationIds.slice(0, 5)) {
      try {
        const repliesResponse = await axios.get(`${TWITTER_API_BASE}/tweets/search/recent`, {
          headers: {
            'Authorization': `Bearer ${BEARER_TOKEN}`
          },
          params: {
            query: `conversation_id:${convId} -from:${username}`,
            max_results: 10,
            'tweet.fields': 'created_at,author_id,public_metrics,text,in_reply_to_user_id',
            'user.fields': 'username,name,profile_image_url',
            expansions: 'author_id'
          }
        });

        const replies = repliesResponse.data.data || [];
        const users = (repliesResponse.data.includes?.users || []).reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});

        replies.forEach(tweet => {
          allReplies.push({
            id: `twitter_${username}_reply_${tweet.id}`,
            source: 'Twitter',
            account: username,
            type: 'reply',
            title: `Reply from @${users[tweet.author_id]?.username || 'unknown'}`,
            content: tweet.text,
            author: users[tweet.author_id]?.username || 'unknown',
            authorName: users[tweet.author_id]?.name || 'Unknown',
            authorAvatar: users[tweet.author_id]?.profile_image_url,
            url: `https://twitter.com/${users[tweet.author_id]?.username || 'unknown'}/status/${tweet.id}`,
            timestamp: new Date(tweet.created_at),
            metrics: tweet.public_metrics
          });
        });
      } catch (error) {
        // Continue with next conversation
        continue;
      }
    }

    return allReplies;
  } catch (error) {
    console.error(`Error fetching Twitter replies for ${username}:`, error.response?.data || error.message);
    return [];
  }
}

async function getLikes(userId, username) {
  try {
    // Note: Twitter API v2 doesn't provide a direct endpoint for likes on your tweets
    // This would require polling your own tweets and checking their like counts
    // For now, we'll return an empty array and note this limitation
    return [];
  } catch (error) {
    console.error(`Error fetching Twitter likes for ${username}:`, error.response?.data || error.message);
    return [];
  }
}

async function getNotifications(username) {
  if (!BEARER_TOKEN) {
    console.warn('⚠️ Twitter Bearer Token not set. Skipping Twitter notifications.');
    return [];
  }

  const userId = await getUserId(username);
  if (!userId) {
    return [];
  }

  const [mentions, replies] = await Promise.all([
    getMentions(userId, username),
    getReplies(userId, username)
  ]);

  return [...mentions, ...replies];
}

module.exports = {
  getNotifications
};
