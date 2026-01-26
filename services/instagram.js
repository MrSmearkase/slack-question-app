const axios = require('axios');

const INSTAGRAM_GRAPH_API = 'https://graph.instagram.com';
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

async function getNotifications(username) {
  if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
    console.warn('⚠️ Instagram credentials not set. Skipping Instagram notifications.');
    return [];
  }

  try {
    // Get user's media
    const mediaResponse = await axios.get(`${INSTAGRAM_GRAPH_API}/${INSTAGRAM_USER_ID}/media`, {
      params: {
        access_token: INSTAGRAM_ACCESS_TOKEN,
        fields: 'id,caption,like_count,comments_count,timestamp,permalink'
      }
    });

    const mediaItems = mediaResponse.data.data || [];
    const allNotifications = [];

    // For each media item, get comments and likes
    for (const media of mediaItems.slice(0, 20)) {
      try {
        // Get comments
        const commentsResponse = await axios.get(`${INSTAGRAM_GRAPH_API}/${media.id}/comments`, {
          params: {
            access_token: INSTAGRAM_ACCESS_TOKEN,
            fields: 'id,text,username,timestamp,like_count'
          }
        });

        const comments = commentsResponse.data.data || [];
        comments.forEach(comment => {
          allNotifications.push({
            id: `instagram_comment_${comment.id}`,
            source: 'Instagram',
            account: username,
            type: 'comment',
            title: `Comment from @${comment.username}`,
            content: comment.text,
            author: comment.username,
            authorName: comment.username,
            url: media.permalink,
            timestamp: new Date(comment.timestamp),
            mediaId: media.id,
            likes: comment.like_count || 0
          });
        });

        // Note: Instagram Graph API doesn't provide individual like notifications
        // We can only see total like counts on posts
        if (media.like_count > 0) {
          allNotifications.push({
            id: `instagram_likes_${media.id}`,
            source: 'Instagram',
            account: username,
            type: 'likes',
            title: `${media.like_count} likes on your post`,
            content: media.caption || '',
            author: 'Instagram',
            authorName: 'Instagram',
            url: media.permalink,
            timestamp: new Date(media.timestamp),
            mediaId: media.id,
            likeCount: media.like_count
          });
        }
      } catch (error) {
        console.error(`Error fetching Instagram data for media ${media.id}:`, error.response?.data || error.message);
        continue;
      }
    }

    return allNotifications;
  } catch (error) {
    console.error(`Error fetching Instagram notifications for ${username}:`, error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  getNotifications
};
