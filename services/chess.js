const axios = require('axios');

const CHESS_COM_API_BASE = 'https://api.chess.com/pub';
const MONITORED_ARTICLES = process.env.CHESS_COM_ARTICLES ? process.env.CHESS_COM_ARTICLES.split(',') : [];
const MONITORED_FORUMS = process.env.CHESS_COM_FORUMS ? process.env.CHESS_COM_FORUMS.split(',') : [];

// Store last known comment IDs to detect new ones
const lastCommentIds = new Map();

async function getArticleComments(articleUrl) {
  try {
    // Chess.com doesn't have a public API for article comments
    // We'll need to scrape or use a different approach
    // For now, return empty array and note the limitation
    return [];
  } catch (error) {
    console.error(`Error fetching Chess.com article comments:`, error.message);
    return [];
  }
}

async function getForumComments(forumUrl) {
  try {
    // Chess.com forum API is limited
    // We'll need to parse the forum URL and make requests
    // For now, return empty array and note the limitation
    return [];
  } catch (error) {
    console.error(`Error fetching Chess.com forum comments:`, error.message);
    return [];
  }
}

async function getNotifications() {
  if (MONITORED_ARTICLES.length === 0 && MONITORED_FORUMS.length === 0) {
    console.log('ℹ️ No Chess.com articles or forums configured to monitor.');
    return [];
  }

  const allNotifications = [];

  // Process articles
  for (const articleUrl of MONITORED_ARTICLES) {
    try {
      const comments = await getArticleComments(articleUrl);
      comments.forEach(comment => {
        allNotifications.push({
          id: `chess_article_${comment.id}`,
          source: 'Chess.com',
          type: 'article_comment',
          title: `New comment on article`,
          content: comment.text,
          author: comment.author,
          authorName: comment.author,
          url: articleUrl,
          timestamp: new Date(comment.timestamp),
          articleUrl: articleUrl
        });
      });
    } catch (error) {
      console.error(`Error processing Chess.com article ${articleUrl}:`, error.message);
    }
  }

  // Process forums
  for (const forumUrl of MONITORED_FORUMS) {
    try {
      const comments = await getForumComments(forumUrl);
      comments.forEach(comment => {
        allNotifications.push({
          id: `chess_forum_${comment.id}`,
          source: 'Chess.com',
          type: 'forum_comment',
          title: `New comment on forum thread`,
          content: comment.text,
          author: comment.author,
          authorName: comment.author,
          url: forumUrl,
          timestamp: new Date(comment.timestamp),
          forumUrl: forumUrl
        });
      });
    } catch (error) {
      console.error(`Error processing Chess.com forum ${forumUrl}:`, error.message);
    }
  }

  return allNotifications;
}

module.exports = {
  getNotifications
};
