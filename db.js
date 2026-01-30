const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false,
});

// Encryption key for tokens (should be in environment variable)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

// Encrypt sensitive data (tokens)
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive data
function decrypt(text) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Initialize database tables
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_tokens (
        team_id VARCHAR(255) PRIMARY KEY,
        bot_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        question_id VARCHAR(255) PRIMARY KEY,
        team_id VARCHAR(255) NOT NULL,
        question_text TEXT NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        message_ts VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        voting_closed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS responses (
        response_id VARCHAR(255) PRIMARY KEY,
        question_id VARCHAR(255) NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
        response_text TEXT NOT NULL,
        message_ts VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS votes (
        vote_id SERIAL PRIMARY KEY,
        response_id VARCHAR(255) NOT NULL REFERENCES responses(response_id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(response_id, user_id)
      )
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_team_id ON questions(team_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_votes_response_id ON votes(response_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_votes_user_response ON votes(response_id, user_id)
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Workspace Token Operations
async function getWorkspaceToken(teamId) {
  try {
    const result = await pool.query(
      'SELECT bot_token FROM workspace_tokens WHERE team_id = $1',
      [teamId]
    );
    if (result.rows.length > 0) {
      return decrypt(result.rows[0].bot_token);
    }
    return null;
  } catch (error) {
    console.error('Error getting workspace token:', error);
    return null;
  }
}

async function setWorkspaceToken(teamId, botToken) {
  try {
    const encryptedToken = encrypt(botToken);
    await pool.query(
      `INSERT INTO workspace_tokens (team_id, bot_token, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (team_id) 
       DO UPDATE SET bot_token = $2, updated_at = CURRENT_TIMESTAMP`,
      [teamId, encryptedToken]
    );
    console.log(`✅ Stored encrypted token for workspace ${teamId}`);
    return true;
  } catch (error) {
    console.error('Error storing workspace token:', error);
    return false;
  }
}

async function getAllWorkspaceTokens() {
  try {
    const result = await pool.query('SELECT team_id, bot_token FROM workspace_tokens');
    const tokens = new Map();
    for (const row of result.rows) {
      const decrypted = decrypt(row.bot_token);
      if (decrypted) {
        tokens.set(row.team_id, decrypted);
      }
    }
    return tokens;
  } catch (error) {
    console.error('Error getting all workspace tokens:', error);
    return new Map();
  }
}

// Question Operations
async function createQuestion(questionId, teamId, questionText, channelId, messageTs, userId) {
  try {
    await pool.query(
      `INSERT INTO questions (question_id, team_id, question_text, channel_id, message_ts, user_id, voting_closed)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
      [questionId, teamId, questionText, channelId, messageTs, userId]
    );
    return true;
  } catch (error) {
    console.error('Error creating question:', error);
    return false;
  }
}

async function getQuestion(questionId) {
  try {
    const result = await pool.query(
      'SELECT * FROM questions WHERE question_id = $1',
      [questionId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        question: row.question_text,
        channel: row.channel_id,
        ts: row.message_ts,
        userId: row.user_id,
        votingClosed: row.voting_closed,
        teamId: row.team_id,
        responses: [] // Will be loaded separately
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting question:', error);
    return null;
  }
}

async function closeVoting(questionId) {
  try {
    await pool.query(
      'UPDATE questions SET voting_closed = TRUE WHERE question_id = $1',
      [questionId]
    );
    return true;
  } catch (error) {
    console.error('Error closing voting:', error);
    return false;
  }
}

async function getQuestionResponses(questionId) {
  try {
    const result = await pool.query(
      'SELECT response_id FROM responses WHERE question_id = $1 ORDER BY created_at',
      [questionId]
    );
    return result.rows.map(row => row.response_id);
  } catch (error) {
    console.error('Error getting question responses:', error);
    return [];
  }
}

// Response Operations
async function createResponse(responseId, questionId, responseText, messageTs) {
  try {
    await pool.query(
      'INSERT INTO responses (response_id, question_id, response_text, message_ts) VALUES ($1, $2, $3, $4)',
      [responseId, questionId, responseText, messageTs]
    );
    return true;
  } catch (error) {
    console.error('Error creating response:', error);
    return false;
  }
}

async function getResponse(responseId) {
  try {
    const result = await pool.query(
      'SELECT * FROM responses WHERE response_id = $1',
      [responseId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      // Get votes for this response
      const votes = await getResponseVotes(responseId);
      return {
        questionId: row.question_id,
        text: row.response_text,
        ts: row.message_ts,
        upvotes: new Set(votes.upvotes),
        downvotes: new Set(votes.downvotes),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting response:', error);
    return null;
  }
}

async function getResponseByTimestamp(teamId, channelId, messageTs) {
  try {
    const result = await pool.query(
      `SELECT r.response_id FROM responses r
       JOIN questions q ON r.question_id = q.question_id
       WHERE q.team_id = $1 AND q.channel_id = $2 AND r.message_ts = $3
       LIMIT 1`,
      [teamId, channelId, messageTs]
    );
    if (result.rows.length > 0) {
      return result.rows[0].response_id;
    }
    return null;
  } catch (error) {
    console.error('Error getting response by timestamp:', error);
    return null;
  }
}

// Vote Operations
async function getResponseVotes(responseId) {
  try {
    const result = await pool.query(
      'SELECT user_id, vote_type FROM votes WHERE response_id = $1',
      [responseId]
    );
    const upvotes = [];
    const downvotes = [];
    for (const row of result.rows) {
      if (row.vote_type === 'upvote') {
        upvotes.push(row.user_id);
      } else {
        downvotes.push(row.user_id);
      }
    }
    return { upvotes, downvotes };
  } catch (error) {
    console.error('Error getting response votes:', error);
    return { upvotes: [], downvotes: [] };
  }
}

async function addVote(responseId, userId, voteType) {
  try {
    // Remove any existing vote from this user
    await pool.query(
      'DELETE FROM votes WHERE response_id = $1 AND user_id = $2',
      [responseId, userId]
    );
    // Add new vote
    await pool.query(
      'INSERT INTO votes (response_id, user_id, vote_type) VALUES ($1, $2, $3)',
      [responseId, userId, voteType]
    );
    return true;
  } catch (error) {
    console.error('Error adding vote:', error);
    return false;
  }
}

async function removeVote(responseId, userId) {
  try {
    await pool.query(
      'DELETE FROM votes WHERE response_id = $1 AND user_id = $2',
      [responseId, userId]
    );
    return true;
  } catch (error) {
    console.error('Error removing vote:', error);
    return false;
  }
}

// Test database connection
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  initializeDatabase,
  testConnection,
  // Workspace tokens
  getWorkspaceToken,
  setWorkspaceToken,
  getAllWorkspaceTokens,
  // Questions
  createQuestion,
  getQuestion,
  closeVoting,
  getQuestionResponses,
  // Responses
  createResponse,
  getResponse,
  getResponseByTimestamp,
  // Votes
  getResponseVotes,
  addVote,
  removeVote,
};
