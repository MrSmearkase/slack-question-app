# Support Information for Anonymous Q and A Bot

## Getting Help

### Documentation
- **README**: See `README.md` for setup and usage instructions
- **Database Setup**: See `DATABASE_SETUP.md` for database configuration
- **Multi-Workspace**: See `MULTI_WORKSPACE_SETUP.md` for multi-workspace installation

### Common Issues

#### App Not Responding
- Verify Socket Mode is enabled in your Slack app settings
- Check that `SLACK_APP_TOKEN` is set correctly (starts with `xapp-`)
- Ensure the app is running and connected

#### Commands Not Working
- Verify the `/ask-question` command is installed in your workspace
- Check that the bot has been invited to the channel
- Ensure the app has the required scopes

#### Reactions Not Updating Points
- Verify `reaction_added` and `reaction_removed` events are subscribed
- Check that the bot is invited to the channel (required to track reactions)
- Reinstall the app to your workspace if issues persist

#### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check database is accessible from your hosting platform
- Ensure `ENCRYPTION_KEY` is set (required for token encryption)

#### Multi-Workspace Installation
- Enable distribution in "Manage Distribution" → "Share Your App"
- Use the shareable link to install to additional workspaces
- Each workspace will have its own bot token stored securely

## Reporting Issues

### GitHub Issues
Report bugs or request features through our GitHub repository:
- [GitHub Issues](https://github.com/MrSmearkase/slack-question-app/issues)

### Feature Requests
We welcome feature requests! Please open an issue on GitHub with:
- Description of the feature
- Use case or problem it solves
- Any relevant examples

## Support Channels

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: Check the README and setup guides first
- **Slack App Directory**: Leave a review or contact through the directory

## Self-Hosting Support

If you're self-hosting the app:
- See `RAILWAY_SETUP.md` for deployment instructions
- See `DATABASE_SETUP.md` for database configuration
- Check application logs for detailed error messages

## Privacy and Security

- See `PRIVACY_POLICY.md` for privacy information
- All tokens are encrypted before storage
- Data is stored securely in PostgreSQL database

---

**Note**: Replace [Your GitHub Repository] with your actual repository URL before submitting to the Slack App Directory.
