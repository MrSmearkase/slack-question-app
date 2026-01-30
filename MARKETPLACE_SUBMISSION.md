# Slack App Directory Submission Guide

This guide will help you prepare and submit Anonymous Q and A Bot to the Slack App Directory.

## Pre-Submission Checklist

### 1. App Configuration ✅

- [x] App manifest configured correctly
- [x] OAuth 2.0 flow implemented
- [x] Multi-workspace support enabled
- [x] Database storage with encryption
- [x] Privacy policy created
- [x] Support documentation created

### 2. Required Information

Before submitting, gather the following:

#### App Details
- **App Name**: Anonymous Q and A Bot
- **Short Description**: Post questions and collect anonymous responses with voting
- **Long Description**: See `manifest.json` for full description
- **App Icon**: 512x512px PNG (required)
- **App Icon (Small)**: 256x256px PNG (required)
- **Screenshots**: At least 3 screenshots showing the app in action

#### Contact Information
- **Support Email**: [Your support email]
- **Privacy Policy URL**: [URL to PRIVACY_POLICY.md]
- **Support URL**: [URL to SUPPORT.md or GitHub issues]
- **GitHub Repository**: https://github.com/MrSmearkase/slack-question-app

#### Legal
- **Privacy Policy**: Must be publicly accessible
- **Terms of Service**: Optional but recommended
- **Support Information**: Must be publicly accessible

### 3. App Icons and Screenshots

#### Required Icons
1. **App Icon (512x512px)**: Main app icon, square, PNG format
2. **App Icon Small (256x256px)**: Smaller version for listings

#### Screenshots (Minimum 3)
1. **Question Posting**: Show `/ask-question` command in action
2. **Response Modal**: Show the anonymous response interface
3. **Voting Interface**: Show responses with upvote/downvote reactions
4. **Results**: Show closed voting with winning response (optional but recommended)

**Screenshot Requirements**:
- Minimum 1280x720px
- PNG or JPG format
- Show actual app functionality
- No placeholder text

### 4. Update Manifest in Slack

1. Go to https://api.slack.com/apps/A0A9N3GQCH4
2. Click **App Manifest**
3. Copy and paste the contents of `manifest.json`
4. Click **Save Changes**

### 5. Enable Distribution

1. Go to **Manage Distribution**
2. Under **Share Your App**:
   - Create a **Shareable Link** (for testing)
   - Prepare for **Slack App Directory** submission

### 6. App Directory Information

Fill out the App Directory form with:

#### Basic Information
- **App Name**: Anonymous Q and A Bot
- **Category**: Communication, Productivity, or Team Tools
- **Description**: Use the long description from manifest.json
- **Tags**: anonymous, Q&A, voting, feedback, surveys, team communication

#### Visual Assets
- Upload app icons (512x512 and 256x256)
- Upload screenshots (minimum 3)
- Add promotional images (optional)

#### Links
- **Privacy Policy**: [Your hosted PRIVACY_POLICY.md URL]
- **Support**: [Your hosted SUPPORT.md URL or GitHub issues]
- **Website**: [Your GitHub repository or website]

#### Pricing
- **Free**: Yes (the app is free to use)
- **Paid Plans**: None

### 7. Testing Checklist

Before submission, test thoroughly:

- [ ] Install app to a test workspace
- [ ] Post a question using `/ask-question`
- [ ] Submit an anonymous response
- [ ] Vote on responses (upvote and downvote)
- [ ] Close voting and verify winner announcement
- [ ] Test in multiple channels
- [ ] Test with multiple users
- [ ] Verify data persistence after restart
- [ ] Test multi-workspace installation
- [ ] Verify error handling

### 8. Submission Process

1. **Prepare Your App**:
   - Complete all checklist items above
   - Test thoroughly
   - Prepare all visual assets

2. **Submit for Review**:
   - Go to **Manage Distribution** → **Slack App Directory**
   - Click **Submit for Review**
   - Fill out the submission form
   - Upload all required assets
   - Submit

3. **Review Process**:
   - Slack reviews typically take 2-4 weeks
   - They will test your app functionality
   - They will verify compliance with policies
   - You may receive feedback or requests for changes

4. **After Approval**:
   - Your app will be listed in the Slack App Directory
   - Users can discover and install your app
   - You can track installations and usage

### 9. Common Rejection Reasons

Avoid these common issues:

- **Missing Privacy Policy**: Must be publicly accessible
- **Poor Error Handling**: App must handle errors gracefully
- **Missing Support Information**: Must provide support contact
- **Incomplete Functionality**: All features must work as described
- **Security Issues**: Tokens must be stored securely (✅ we encrypt them)
- **Poor User Experience**: App must be intuitive and helpful

### 10. Post-Submission

After submission:

- Monitor your app's status in the Slack dashboard
- Respond promptly to any feedback from Slack
- Be prepared to make changes if requested
- Keep your app updated and maintained

## Hosting Requirements

For App Directory approval, your app must be:

- **Always Available**: Running 24/7 (Railway handles this ✅)
- **Stable**: No frequent crashes or downtime
- **Scalable**: Handle multiple workspace installations
- **Secure**: Encrypted data storage (✅ we have this)

## Additional Resources

- [Slack App Directory Guidelines](https://api.slack.com/distribution)
- [Slack App Review Process](https://api.slack.com/reference/apps/guidelines)
- [Slack API Terms of Service](https://slack.com/terms-of-service/api)

## Next Steps

1. Create app icons (512x512 and 256x256)
2. Take screenshots of the app in action
3. Host PRIVACY_POLICY.md and SUPPORT.md publicly (GitHub Pages, or your website)
4. Update placeholder information in PRIVACY_POLICY.md and SUPPORT.md
5. Test the app thoroughly
6. Submit to Slack App Directory

Good luck with your submission! 🚀
