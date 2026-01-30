const { App } = require('@slack/bolt');
const fs = require('fs');
const path = require('path');
const db = require('./db');
require('dotenv').config();

// Set up file logging
const logFile = path.join(__dirname, 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Override console.log to also write to file
const originalLog = console.log;
console.log = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
  originalLog.apply(console, args);
};

const originalError = console.error;
console.error = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ERROR: ${message}\n`);
  originalError.apply(console, args);
};

// Get and trim environment variables
const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
const appToken = process.env.SLACK_APP_TOKEN?.trim();

// Load initial token from env if provided (for backward compatibility)
let initialToken = null;
if (process.env.SLACK_BOT_TOKEN) {
  initialToken = process.env.SLACK_BOT_TOKEN.trim();
}

// Workspace tokens are now stored in database (encrypted)
// Cache for quick access (loaded from database on startup)
const workspaceTokens = new Map(); // teamId -> botToken (cached from database)

// Initialize the Slack app without a default token (will use workspace-specific tokens)
const app = new App({
  signingSecret: signingSecret,
  socketMode: true,
  appToken: appToken,
  // Don't set a default token - we'll use workspace-specific tokens
  authorize: async ({ teamId, enterpriseId }) => {
    // First check cache
    let token = workspaceTokens.get(teamId);
    
    // If not in cache, try database
    if (!token) {
      token = await db.getWorkspaceToken(teamId);
      if (token) {
        workspaceTokens.set(teamId, token); // Cache it
        console.log(`✅ Loaded token for workspace ${teamId} from database`);
      }
    }
    
    // If no token found, try to use initial token from env (for first workspace)
    if (!token && initialToken) {
      token = initialToken;
      await db.setWorkspaceToken(teamId, token);
      workspaceTokens.set(teamId, token);
      console.log(`✅ Using initial token for workspace ${teamId} and storing in database`);
    }
    
    // If we have a token, return it
    if (token) {
      return {
        botToken: token,
        botId: undefined, // Will be fetched automatically
        botUserId: undefined, // Will be fetched automatically
      };
    }
    
    // Last resort: return undefined to let Bolt handle it
    // The token will be captured from client.token in handlers
    console.warn(`⚠️ No token available for workspace ${teamId} - will attempt to capture from client`);
    return undefined;
  },
});

// Helper function to get workspace-specific client
function getWorkspaceClient(teamId) {
  const token = workspaceTokens.get(teamId);
  if (!token) {
    throw new Error(`No token found for workspace ${teamId}`);
  }
  return new app.client.constructor({ token });
}

// Helper to store workspace token when first encountered
async function storeWorkspaceToken(teamId, token) {
  if (teamId && token) {
    // Store in database (encrypted)
    await db.setWorkspaceToken(teamId, token);
    // Also cache in memory
    workspaceTokens.set(teamId, token);
    console.log(`✅ Stored token (encrypted) for workspace ${teamId}`);
    return true;
  }
  return false;
}

// Load initial workspace token from environment (for backward compatibility)
if (process.env.SLACK_BOT_TOKEN) {
  // If a token is provided via env, we need to determine the workspace
  // For now, we'll store it with a placeholder and update it when we get the first event
  const initialToken = process.env.SLACK_BOT_TOKEN.trim();
  console.log('⚠️ Initial token provided via environment. Will be associated with first workspace that connects.');
  // We'll store this when we get the first team_id from an event
}

// Generate unique IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calculate points for a response
async function calculatePoints(responseId) {
  const votes = await db.getResponseVotes(responseId);
  return votes.upvotes.length - votes.downvotes.length;
}

// Update response message with point total
async function updateResponseMessage(responseId, teamId) {
  const response = await db.getResponse(responseId);
  if (!response) {
    console.log('⚠️ Response not found for ID:', responseId);
    return;
  }

  const question = await db.getQuestion(response.questionId);
  if (!question) {
    console.log('⚠️ Question not found for response:', responseId);
    return;
  }

  const points = await calculatePoints(responseId);
  const pointsText = points > 0 ? `+${points}` : points.toString();
  
  console.log(`🔄 Updating response ${responseId} with points: ${pointsText}`);
  console.log(`   Channel: ${question.channel}, Timestamp: ${response.ts}`);
  
  try {
    const client = getWorkspaceClient(teamId);
    const result = await client.chat.update({
      channel: question.channel,
      ts: response.ts,
      text: `${response.text}\n\n*Points: ${pointsText}*`,
    });
    
    if (result.ok) {
      console.log(`✅✅✅ Successfully updated response ${responseId} - Message updated in Slack! ✅✅✅`);
      console.log(`   New points: ${pointsText}`);
    } else {
      console.error(`❌ Update API call failed: ${result.error}`);
      if (result.error === 'message_not_found') {
        console.error('   The message may have been deleted or the timestamp is incorrect');
      } else if (result.error === 'cant_update_message') {
        console.error('   Bot does not have permission to update this message');
      }
    }
  } catch (error) {
    console.error('❌ Exception updating response message:', error);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      data: error.data
    });
  }
}

// Command to post a question
app.command('/ask-question', async ({ command, ack, respond, client }) => {
  console.log('✅ Command received:', JSON.stringify(command, null, 2));
  
  const teamId = command.team_id;
  
  // Ensure workspace token is stored
  if (!workspaceTokens.has(teamId)) {
    // Try database first
    const dbToken = await db.getWorkspaceToken(teamId);
    if (dbToken) {
      workspaceTokens.set(teamId, dbToken);
    } else if (client.token) {
      // Try to use the client's token if available
      await storeWorkspaceToken(teamId, client.token);
    } else if (initialToken) {
      // Use initial token from environment for first workspace
      await storeWorkspaceToken(teamId, initialToken);
      initialToken = null; // Clear it so it's only used once
    } else {
      await respond('❌ This workspace is not properly configured. Please reinstall the app.');
      return;
    }
  }
  
  try {
    await ack();
    console.log('✅ Command acknowledged');
  } catch (error) {
    console.error('❌ Error acknowledging command:', error);
    return;
  }

  const questionText = command.text ? command.text.trim() : '';
  if (!questionText) {
    await respond('Please provide a question. Usage: /ask-question <your question>');
    return;
  }

  try {
    const questionId = generateId();
    const result = await client.chat.postMessage({
      channel: command.channel_id,
      text: `*Question:* ${questionText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Question:* ${questionText}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Respond',
              },
              action_id: 'respond_to_question',
              value: questionId,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Close Voting',
              },
              action_id: 'close_voting',
              value: questionId,
              style: 'danger',
            },
          ],
        },
      ],
    });

    // Store question in database
    await db.createQuestion(
      questionId,
      teamId,
      questionText,
      command.channel_id,
      result.ts,
      command.user_id
    );

    // Send confirmation with reminder about inviting the bot
    await respond({
      text: 'Question posted!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *Question posted successfully!*\n\n💡 *Tip:* To enable automatic vote tallying, make sure the bot is invited to this channel. Type `/invite @Anonymous Q and A Bot` if you haven\'t already.',
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error posting question:', error);
    await respond('Failed to post question. Please try again.');
  }
});

// Handle close voting button click
app.action('close_voting', async ({ ack, body, client }) => {
  await ack();

  const questionId = body.actions[0].value;
  const question = await db.getQuestion(questionId);
  const teamId = body.team?.id || body.user?.team_id;

  if (!question) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Question not found.',
    });
    return;
  }

  // Check if the user is the one who posted the question
  if (question.userId !== body.user.id) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Only the person who posted the question can close voting.',
    });
    return;
  }

  // Check if voting is already closed
  if (question.votingClosed) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Voting is already closed for this question.',
    });
    return;
  }

  // Mark voting as closed in database
  await db.closeVoting(questionId);

  // Find the response with the most votes
  let winningResponse = null;
  let maxPoints = -Infinity;

  const responseIds = await db.getQuestionResponses(questionId);
  for (const responseId of responseIds) {
    const response = await db.getResponse(responseId);
    if (response) {
      const points = await calculatePoints(responseId);
      if (points > maxPoints) {
        maxPoints = points;
        winningResponse = response;
      }
    }
  }

  // Update the original question message to show voting is closed
  try {
    await client.chat.update({
      channel: question.channel,
      ts: question.ts,
      text: `*Question:* ${question.question}\n\n*Voting is now closed.*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Question:* ${question.question}\n\n*Voting is now closed.*`,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error updating question message:', error);
  }

  // Post announcement of the winner
  try {
    if (winningResponse && maxPoints >= 0) {
      await client.chat.postMessage({
        channel: question.channel,
        text: `🏆 *Voting Results*\n\n*Question:* ${question.question}\n\n*Winning Response:*\n${winningResponse.text}\n\n*Final Score: ${maxPoints > 0 ? '+' : ''}${maxPoints} points*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🏆 *Voting Results*\n\n*Question:* ${question.question}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Winning Response:*\n${winningResponse.text}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Final Score: ${maxPoints > 0 ? '+' : ''}${maxPoints} points*`,
            },
          },
        ],
      });
      console.log(`✅ Voting closed for question ${questionId}. Winner announced with ${maxPoints} points.`);
    } else {
      const responseIds = await db.getQuestionResponses(questionId);
      if (responseIds.length === 0) {
      await client.chat.postMessage({
        channel: question.channel,
        text: `📊 *Voting Results*\n\n*Question:* ${question.question}\n\n*No responses were submitted.*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📊 *Voting Results*\n\n*Question:* ${question.question}\n\n*No responses were submitted.*`,
            },
          },
        ],
      });
      console.log(`✅ Voting closed for question ${questionId}. No responses.`);
    } else {
      // All responses have negative or zero points
      await client.chat.postMessage({
        channel: question.channel,
        text: `📊 *Voting Results*\n\n*Question:* ${question.question}\n\n*No response received positive votes.*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📊 *Voting Results*\n\n*Question:* ${question.question}\n\n*No response received positive votes.*`,
            },
          },
        ],
      });
      console.log(`✅ Voting closed for question ${questionId}. No positive votes.`);
    }
  } catch (error) {
    console.error('Error posting voting results:', error);
  }
});

// Handle response button click
app.action('respond_to_question', async ({ ack, body, client }) => {
  await ack();

  const questionId = body.actions[0].value;
  const question = await db.getQuestion(questionId);
  const teamId = body.team?.id || body.user?.team_id;

  if (!question) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Question not found.',
    });
    return;
  }

  // Check if voting is closed
  if (question.votingClosed) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Voting is closed for this question. No new responses can be submitted.',
    });
    return;
  }

  // Open modal for response
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'response_modal',
        title: {
          type: 'plain_text',
          text: 'Submit Response',
        },
        submit: {
          type: 'plain_text',
          text: 'Submit',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Question:* ${question.question}`,
            },
          },
          {
            type: 'input',
            block_id: 'response_input',
            element: {
              type: 'plain_text_input',
              action_id: 'response_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your response...',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Your Response',
            },
          },
        ],
        private_metadata: questionId,
      },
    });
  } catch (error) {
    console.error('Error opening modal:', error);
  }
});

// Handle modal submission
app.view('response_modal', async ({ ack, body, view, client }) => {
  await ack();

  const questionId = view.private_metadata;
  const question = await db.getQuestion(questionId);
  const responseText = view.state.values.response_input.response_text.value.trim();
  const teamId = body.team?.id || body.user?.team_id;

  if (!responseText) {
    return;
  }

  if (!question) {
    return;
  }

  try {
    // Post anonymous response in thread
    const result = await client.chat.postMessage({
      channel: question.channel,
      thread_ts: question.ts,
      text: `${responseText}\n\n*Points: 0*`,
    });

    const responseId = generateId();
    // Store response in database
    await db.createResponse(responseId, questionId, responseText, result.ts);
    
    console.log(`✅ Response posted and tracked:`);
    console.log(`   Response ID: ${responseId}`);
    console.log(`   Timestamp: ${result.ts}`);
    console.log(`   Channel: ${question.channel}`);
    console.log(`   Workspace: ${teamId}`);

    // Automatically add thumbs up and thumbs down reactions to the response
    try {
      // Add thumbs up reaction - use the token explicitly
      await client.reactions.add({
        channel: question.channel,
        timestamp: result.ts,
        name: '+1' // Slack's standard thumbs up emoji name
      });
      console.log('✅ Added 👍 reaction to response');
      
      // Small delay between reactions
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Add thumbs down reaction
      await client.reactions.add({
        channel: question.channel,
        timestamp: result.ts,
        name: '-1' // Slack's standard thumbs down emoji name
      });
      console.log('✅ Added 👎 reaction to response');
    } catch (reactionError) {
      console.error('⚠️ Error adding reactions:', reactionError.message);
      console.error('   Error code:', reactionError.code);
      console.error('   This might mean the bot needs to be invited to the channel');
      // Don't fail the whole operation if reactions fail
    }
  } catch (error) {
    console.error('Error posting response:', error);
  }
});

// Debug: Log ALL events to see what we're receiving (this runs first, then specific handlers)
app.event(/.*/, async ({ event, logger, next }) => {
  if (event && event.type) {
    console.log(`📨📨📨 EVENT RECEIVED: ${event.type} 📨📨📨`);
    if (event.type === 'reaction_added' || event.type === 'reaction_removed') {
      console.log(`🔔🔔🔔 REACTION EVENT DETECTED: ${event.type} 🔔🔔🔔`);
      console.log('Full event object:', JSON.stringify(event, null, 2));
    }
  } else {
    console.log('📨 Event received but no type:', JSON.stringify(event, null, 2));
  }
  // Call next() to allow other handlers to process the event
  await next();
});

// Handle reaction added (for voting)
app.event('reaction_added', async ({ event, client }) => {
  const teamId = event.team;
  
  // Ensure workspace token is stored
  if (teamId && !workspaceTokens.has(teamId)) {
    const dbToken = await db.getWorkspaceToken(teamId);
    if (dbToken) {
      workspaceTokens.set(teamId, dbToken);
    } else if (client.token) {
      await storeWorkspaceToken(teamId, client.token);
    } else if (initialToken) {
      await storeWorkspaceToken(teamId, initialToken);
      initialToken = null;
    }
  }
  
  console.log('🔔 Reaction added event received');
  console.log('Event details:', {
    reaction: event.reaction,
    user: event.user,
    item_type: event.item?.type,
    item_ts: event.item?.ts,
    item_channel: event.item?.channel,
    event_ts: event.event_ts,
    team: event.team
  });
  
  // Only process reactions on messages
  if (!event.item || event.item.type !== 'message' || !event.item.ts || !event.item.channel) {
    console.log('⚠️ Invalid reaction event - not a message reaction or missing data');
    return;
  }

  const reactionTs = event.item.ts;
  const reactionChannel = event.item.channel;

  // Find the response this reaction is on - match both timestamp and channel
  const responseId = await db.getResponseByTimestamp(teamId, reactionChannel, reactionTs);

  if (!responseId) {
    console.log('⚠️ Reaction not on a tracked response message');
    console.log(`Looking for ts: ${reactionTs}, channel: ${reactionChannel}, team: ${teamId}`);
    return;
  }

  const reaction = event.reaction;
  console.log(`📊 Processing reaction "${reaction}" on response ${responseId} by user ${event.user}`);

  // Handle thumbs up (upvote) - check multiple possible reaction names
  if (reaction === '+1' || reaction === 'thumbsup' || reaction === 'thumbsup_all' || reaction === '👍' || reaction === 'thumbs_up') {
    console.log('✅ Thumbs up detected - adding upvote');
    await db.addVote(responseId, event.user, 'upvote');
    const votes = await db.getResponseVotes(responseId);
    console.log(`📈 Upvotes: ${votes.upvotes.length}, Downvotes: ${votes.downvotes.length}`);
    await updateResponseMessage(responseId, teamId);
  }
  // Handle thumbs down (downvote) - check multiple possible reaction names
  else if (reaction === '-1' || reaction === 'thumbsdown' || reaction === 'thumbsdown_all' || reaction === '👎' || reaction === 'thumbs_down') {
    console.log('✅ Thumbs down detected - adding downvote');
    await db.addVote(responseId, event.user, 'downvote');
    const votes = await db.getResponseVotes(responseId);
    console.log(`📉 Upvotes: ${votes.upvotes.length}, Downvotes: ${votes.downvotes.length}`);
    await updateResponseMessage(responseId, teamId);
  } else {
    console.log(`ℹ️ Ignoring reaction: ${reaction} (not thumbs up/down)`);
  }
});

// Handle reaction removed (for unvoting)
app.event('reaction_removed', async ({ event, client }) => {
  const teamId = event.team;
  
  console.log('🔔 Reaction removed event received');
  console.log('Event details:', {
    reaction: event.reaction,
    user: event.user,
    item_ts: event.item?.ts,
    item_channel: event.item?.channel,
    team: event.team
  });
  
  if (!event.item || event.item.type !== 'message' || !event.item.ts || !event.item.channel) {
    return;
  }

  const reactionTs = event.item.ts;
  const reactionChannel = event.item.channel;

  // Find the response this reaction is on
  const responseId = await db.getResponseByTimestamp(teamId, reactionChannel, reactionTs);

  if (!responseId) {
    return;
  }

  const reaction = event.reaction;
  console.log(`📊 Removing reaction "${reaction}" from response ${responseId}`);

  if (reaction === '+1' || reaction === 'thumbsup' || reaction === 'thumbsup_all' || reaction === '👍' || reaction === 'thumbs_up') {
    await db.removeVote(responseId, event.user);
    const votes = await db.getResponseVotes(responseId);
    console.log(`📈 Upvotes: ${votes.upvotes.length}, Downvotes: ${votes.downvotes.length}`);
    await updateResponseMessage(responseId, teamId);
  } else if (reaction === '-1' || reaction === 'thumbsdown' || reaction === 'thumbsdown_all' || reaction === '👎' || reaction === 'thumbs_down') {
    await db.removeVote(responseId, event.user);
    const votes = await db.getResponseVotes(responseId);
    console.log(`📉 Upvotes: ${votes.upvotes.length}, Downvotes: ${votes.downvotes.length}`);
    await updateResponseMessage(responseId, teamId);
  }
});

// Start the app
(async () => {
  try {
    console.log('Starting Slack app with database support...');
    
    // Initialize database
    if (process.env.DATABASE_URL) {
      console.log('📦 Connecting to database...');
      const dbConnected = await db.testConnection();
      if (dbConnected) {
        await db.initializeDatabase();
        console.log('✅ Database initialized successfully');
        
        // Load existing workspace tokens from database
        const tokens = await db.getAllWorkspaceTokens();
        tokens.forEach((token, teamId) => {
          workspaceTokens.set(teamId, token);
        });
        console.log(`✅ Loaded ${tokens.size} workspace token(s) from database`);
      } else {
        console.error('❌ Database connection failed. App will continue but data will not persist.');
        console.error('   Set DATABASE_URL environment variable to enable database storage.');
      }
    } else {
      console.log('⚠️ DATABASE_URL not set - using in-memory storage (data will be lost on restart)');
      console.log('   To enable database storage, add PostgreSQL service in Railway and set DATABASE_URL');
    }
    
    // Validate environment variables
    console.log('Signing Secret:', signingSecret ? `Set (${signingSecret.substring(0, 10)}...)` : '❌ MISSING');
    console.log('App Token:', appToken ? `Set (${appToken.substring(0, 10)}...)` : '❌ MISSING');
    
    if (!signingSecret || !appToken) {
      console.error('❌ ERROR: Missing required environment variables!');
      console.error('Please set the following in Railway Variables:');
      console.error('  - SLACK_SIGNING_SECRET');
      console.error('  - SLACK_APP_TOKEN');
      console.error('  - DATABASE_URL (optional but recommended)');
      console.error('Note: SLACK_BOT_TOKEN is optional - tokens are stored per workspace');
      process.exit(1);
    }
    
    // Verify token formats
    if (!appToken.startsWith('xapp-')) {
      console.error('❌ ERROR: SLACK_APP_TOKEN should start with "xapp-"');
      process.exit(1);
    }
    
    // Log initial token status
    if (initialToken) {
      console.log('⚠️ SLACK_BOT_TOKEN provided in environment.');
      console.log('   This will be used for the first workspace that connects.');
      console.log('   For multi-workspace support, install the app via OAuth to each workspace.');
    }
    
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`⚡️ Slack app is running on port ${port}!`);
    console.log('Waiting for workspace connections...');
    console.log('');
    console.log('📋 Features enabled:');
    console.log('   - Multi-workspace support');
    console.log('   - Database persistence (if DATABASE_URL is set)');
    console.log('   - Encrypted token storage');
    console.log('   - Questions and responses tracked per workspace');
  } catch (error) {
    console.error('Failed to start app:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      data: error.data
    });
    process.exit(1);
  }
})();

// Error handling
app.error((error) => {
  console.error('App error:', error);
});

// Log connection status and verify event subscriptions
(async () => {
  try {
    // Wait a bit for Socket Mode to fully connect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('');
    console.log('🔍 EVENT SUBSCRIPTION CHECK:');
    console.log('If you don\'t see events, verify in Slack app settings:');
    console.log('  1. Event Subscriptions → Enable Events = ON');
    console.log('  2. Subscribe to bot events: reaction_added, reaction_removed');
    console.log('  3. OAuth & Permissions → Install to Workspace (for each workspace)');
    console.log('  4. Restart this app after installing to new workspaces');
    console.log('');
    console.log(`📊 Currently tracking ${workspaceTokens.size} workspace(s)`);
  } catch (error) {
    console.error('❌ Error during startup check:', error.message);
  }
})();
