const { App } = require('@slack/bolt');
const fs = require('fs');
const path = require('path');
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

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Store for tracking responses and votes
// In production, you'd want to use a database
const questionStore = new Map(); // questionId -> { question, channel, ts, responses: [], userId, votingClosed: false }
const responseStore = new Map(); // responseId -> { questionId, text, ts, upvotes: Set, downvotes: Set }

// Generate unique IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calculate points for a response
function calculatePoints(responseId) {
  const response = responseStore.get(responseId);
  if (!response) return 0;
  return response.upvotes.size - response.downvotes.size;
}

// Update response message with point total
async function updateResponseMessage(responseId) {
  const response = responseStore.get(responseId);
  if (!response) {
    console.log('⚠️ Response not found for ID:', responseId);
    return;
  }

  const question = questionStore.get(response.questionId);
  if (!question) {
    console.log('⚠️ Question not found for response:', responseId);
    return;
  }

  const points = calculatePoints(responseId);
  const pointsText = points > 0 ? `+${points}` : points.toString();
  
  console.log(`🔄 Updating response ${responseId} with points: ${pointsText}`);
  console.log(`   Channel: ${question.channel}, Timestamp: ${response.ts}`);
  
  try {
    const result = await app.client.chat.update({
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

    // Store question with the user who posted it
    questionStore.set(questionId, {
      question: questionText,
      channel: command.channel_id,
      ts: result.ts,
      responses: [],
      userId: command.user_id, // Store who posted the question
      votingClosed: false,
    });

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
  const question = questionStore.get(questionId);

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

  // Mark voting as closed
  question.votingClosed = true;

  // Find the response with the most votes
  let winningResponse = null;
  let maxPoints = -Infinity;

  for (const responseId of question.responses) {
    const response = responseStore.get(responseId);
    if (response) {
      const points = calculatePoints(responseId);
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
    } else if (question.responses.length === 0) {
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
  const question = questionStore.get(questionId);

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
  const question = questionStore.get(questionId);
  const responseText = view.state.values.response_input.response_text.value.trim();

  if (!responseText) {
    return;
  }

  if (!question) {
    return;
  }

  try {
    // Post anonymous response in thread
    const result = await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: question.channel,
      thread_ts: question.ts,
      text: `${responseText}\n\n*Points: 0*`,
    });

    const responseId = generateId();
    responseStore.set(responseId, {
      questionId: questionId,
      text: responseText,
      ts: result.ts,
      upvotes: new Set(),
      downvotes: new Set(),
    });

    question.responses.push(responseId);
    
    console.log(`✅ Response posted and tracked:`);
    console.log(`   Response ID: ${responseId}`);
    console.log(`   Timestamp: ${result.ts}`);
    console.log(`   Channel: ${question.channel}`);

    // Automatically add thumbs up and thumbs down reactions to the response
    try {
      // Add thumbs up reaction - use the token explicitly
      await app.client.reactions.add({
        token: process.env.SLACK_BOT_TOKEN,
        channel: question.channel,
        timestamp: result.ts,
        name: '+1' // Slack's standard thumbs up emoji name
      });
      console.log('✅ Added 👍 reaction to response');
      
      // Small delay between reactions
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Add thumbs down reaction
      await app.client.reactions.add({
        token: process.env.SLACK_BOT_TOKEN,
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
app.event('reaction_added', async ({ event, client, logger }) => {
  logger.info('🔔 Reaction added event handler triggered');
  console.log('🔔 Reaction added event received');
  console.log('Event details:', {
    reaction: event.reaction,
    user: event.user,
    item_type: event.item?.type,
    item_ts: event.item?.ts,
    item_channel: event.item?.channel,
    event_ts: event.event_ts
  });
  
  // Only process reactions on messages
  if (!event.item || event.item.type !== 'message' || !event.item.ts || !event.item.channel) {
    console.log('⚠️ Invalid reaction event - not a message reaction or missing data');
    return;
  }

  const reactionTs = event.item.ts;
  const reactionChannel = event.item.channel;

  // Find the response this reaction is on - match both timestamp and channel
  let responseId = null;
  for (const [id, response] of responseStore.entries()) {
    const question = questionStore.get(response.questionId);
    if (question && 
        response.ts === reactionTs && 
        question.channel === reactionChannel) {
      responseId = id;
      console.log(`✅ Found matching response: ${responseId}`);
      break;
    }
  }

  if (!responseId) {
    console.log('⚠️ Reaction not on a tracked response message');
    console.log(`Looking for ts: ${reactionTs}, channel: ${reactionChannel}`);
    console.log('Tracked responses:', Array.from(responseStore.keys()));
    return;
  }

  const response = responseStore.get(responseId);
  const reaction = event.reaction;
  console.log(`📊 Processing reaction "${reaction}" on response ${responseId} by user ${event.user}`);

  // Handle thumbs up (upvote) - check multiple possible reaction names
  if (reaction === '+1' || reaction === 'thumbsup' || reaction === 'thumbsup_all' || reaction === '👍' || reaction === 'thumbs_up') {
    console.log('✅ Thumbs up detected - adding upvote');
    response.upvotes.add(event.user);
    // Remove from downvotes if present
    response.downvotes.delete(event.user);
    console.log(`📈 Upvotes: ${response.upvotes.size}, Downvotes: ${response.downvotes.size}`);
    await updateResponseMessage(responseId);
  }
  // Handle thumbs down (downvote) - check multiple possible reaction names
  else if (reaction === '-1' || reaction === 'thumbsdown' || reaction === 'thumbsdown_all' || reaction === '👎' || reaction === 'thumbs_down') {
    console.log('✅ Thumbs down detected - adding downvote');
    response.downvotes.add(event.user);
    // Remove from upvotes if present
    response.upvotes.delete(event.user);
    console.log(`📉 Upvotes: ${response.upvotes.size}, Downvotes: ${response.downvotes.size}`);
    await updateResponseMessage(responseId);
  } else {
    console.log(`ℹ️ Ignoring reaction: ${reaction} (not thumbs up/down)`);
  }
});

// Handle reaction removed (for unvoting)
app.event('reaction_removed', async ({ event, client }) => {
  console.log('🔔 Reaction removed event received');
  console.log('Event details:', {
    reaction: event.reaction,
    user: event.user,
    item_ts: event.item?.ts,
    item_channel: event.item?.channel
  });
  
  if (!event.item || event.item.type !== 'message' || !event.item.ts || !event.item.channel) {
    return;
  }

  const reactionTs = event.item.ts;
  const reactionChannel = event.item.channel;

  let responseId = null;
  for (const [id, response] of responseStore.entries()) {
    const question = questionStore.get(response.questionId);
    if (question && 
        response.ts === reactionTs && 
        question.channel === reactionChannel) {
      responseId = id;
      break;
    }
  }

  if (!responseId) {
    return;
  }

  const response = responseStore.get(responseId);
  const reaction = event.reaction;
  console.log(`📊 Removing reaction "${reaction}" from response ${responseId}`);

  if (reaction === '+1' || reaction === 'thumbsup' || reaction === 'thumbsup_all' || reaction === '👍' || reaction === 'thumbs_up') {
    response.upvotes.delete(event.user);
    console.log(`📈 Upvotes: ${response.upvotes.size}, Downvotes: ${response.downvotes.size}`);
    await updateResponseMessage(responseId);
  } else if (reaction === '-1' || reaction === 'thumbsdown' || reaction === 'thumbsdown_all' || reaction === '👎' || reaction === 'thumbs_down') {
    response.downvotes.delete(event.user);
    console.log(`📉 Upvotes: ${response.upvotes.size}, Downvotes: ${response.downvotes.size}`);
    await updateResponseMessage(responseId);
  }
});

// Start the app
(async () => {
  try {
    console.log('Starting Slack app...');
    console.log('Bot Token:', process.env.SLACK_BOT_TOKEN ? 'Set' : 'Missing');
    console.log('Signing Secret:', process.env.SLACK_SIGNING_SECRET ? 'Set' : 'Missing');
    console.log('App Token:', process.env.SLACK_APP_TOKEN ? 'Set' : 'Missing');
    
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`⚡️ Slack app is running on port ${port}!`);
    console.log('Waiting for connection to Slack...');
  } catch (error) {
    console.error('Failed to start app:', error);
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
    const authResult = await app.client.auth.test();
    console.log('✅ App authenticated as:', authResult.user);
    console.log('✅ Team:', authResult.team);
    
    // Wait a bit for Socket Mode to fully connect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('');
    console.log('🔍 EVENT SUBSCRIPTION CHECK:');
    console.log('If you don\'t see events, verify in Slack app settings:');
    console.log('  1. Event Subscriptions → Enable Events = ON');
    console.log('  2. Subscribe to bot events: reaction_added, reaction_removed');
    console.log('  3. OAuth & Permissions → Reinstall to Workspace');
    console.log('  4. Restart this app after reinstalling');
    console.log('');
  } catch (error) {
    console.error('❌ Auth test failed:', error.message);
  }
})();
