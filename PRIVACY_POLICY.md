# Privacy Policy for Anonymous Q and A Bot

**Last Updated:** [Date]

## Introduction

Anonymous Q and A Bot ("the App") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard information when you use our Slack application.

## Information We Collect

### Workspace Information
- **Workspace ID**: We store your workspace's unique identifier (team_id) to associate data with your workspace
- **Bot Token**: We securely store and encrypt your workspace's bot token to enable app functionality

### User-Generated Content
- **Questions**: Questions posted using the `/ask-question` command
- **Responses**: Anonymous responses submitted by users
- **Votes**: Upvote and downvote reactions on responses

### Technical Information
- **Channel IDs**: To post messages in the correct channels
- **Message Timestamps**: To track and update messages
- **User IDs**: Only for the question poster (to enable "Close Voting" functionality)

## How We Use Information

- **App Functionality**: To enable question posting, anonymous responses, and voting
- **Message Management**: To update response messages with point totals
- **Workspace Management**: To maintain separate data for each workspace

## Data Storage and Security

- **Database Storage**: All data is stored in a PostgreSQL database
- **Encryption**: Workspace bot tokens are encrypted using AES-256-CBC encryption before storage
- **Access Control**: Only the app has access to the database
- **SSL Connections**: All database connections use SSL encryption

## Data Retention

- **Questions and Responses**: Stored indefinitely until manually deleted
- **Votes**: Stored indefinitely to maintain point totals
- **Workspace Tokens**: Stored until the app is uninstalled from the workspace

## Data Sharing

We do not share, sell, or distribute your data to third parties. All data is:
- Stored securely in our database
- Used solely for app functionality
- Not shared with external services

## Anonymous Responses

- Responses are posted anonymously - the original responder is never identified
- We do not track or store which user submitted which response
- Only the question poster's user ID is stored (for "Close Voting" functionality)

## Your Rights

- **Uninstall**: You can uninstall the app at any time from your Slack workspace settings
- **Data Deletion**: Uninstalling the app removes all associated data from our database
- **Access**: You can view all questions and responses posted in your workspace through Slack

## Children's Privacy

This app is not intended for users under 13 years of age. We do not knowingly collect information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify users of any material changes by posting the new policy on this page.

## Contact Us

If you have questions about this Privacy Policy, please contact us through:
- GitHub Issues: [Your GitHub Repository]
- Email: [Your Support Email]

## Compliance

This app complies with:
- Slack's API Terms of Service
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)

---

**Note**: Replace [Date], [Your GitHub Repository], and [Your Support Email] with your actual information before submitting to the Slack App Directory.
