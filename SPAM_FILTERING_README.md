# Spam Filtering System

This document describes the spam filtering functionality added to the email alias service.

## Features

### 1. Spam Classification API
- **Endpoint**: `/api/spam/classify`
- **Method**: POST
- **Purpose**: Classify email content as spam or legitimate
- **Input**: `{ text, subject, sender }`
- **Output**: `{ isSpam, confidence, reason, details }`

### 2. Spam Settings Management
- **Endpoint**: `/api/spam/settings`
- **Methods**: GET, POST
- **Purpose**: Manage user's spam filtering preferences
- **Settings**:
  - `enabled`: Enable/disable spam filtering
  - `sensitivity`: Low, Medium, High detection levels
  - `autoDelete`: Automatically delete spam emails
  - `notifications`: Get notified when spam is detected
  - `whitelist`: List of trusted senders
  - `blacklist`: List of blocked senders

### 3. Spam Statistics
- **Endpoint**: `/api/spam/stats`
- **Method**: GET
- **Purpose**: View spam filtering statistics and recent activity
- **Data**: Total emails, spam detected, accuracy, recent spam emails

### 4. Dashboard Integration
- New "Spam Filtering" tab in the dashboard
- Real-time statistics display
- Settings management interface
- Spam test tool for testing classification
- Recent spam activity view

## How It Works

### Classification Algorithm
The spam classifier uses a rule-based approach with the following features:

1. **Keyword Analysis**:
   - Spam keywords: "free", "win", "congratulations", "urgent", etc.
   - Ham keywords: "meeting", "project", "business", etc.

2. **Pattern Detection**:
   - Excessive capitalization
   - Multiple exclamation marks
   - Suspicious URLs
   - Long number sequences

3. **Scoring System**:
   - Each indicator adds to the spam score
   - Legitimate indicators reduce the score
   - Threshold-based classification

### Email Processing Flow
1. Email received via webhook
2. Spam classification performed
3. User settings applied (sensitivity, auto-delete)
4. Email either delivered, quarantined, or deleted
5. Notification sent if enabled
6. Statistics updated

## Configuration

### Environment Variables
- `NEXT_PUBLIC_BASE_URL`: Base URL for internal API calls
- `MAILGUN_API_KEY`: Mailgun API key for notifications
- `MAILGUN_DOMAIN`: Mailgun domain for sending emails

### Database Schema
The system adds the following fields to the `inbox` collection:
- `isSpam`: Boolean indicating if email is spam
- `spamConfidence`: Confidence score (0-1)
- `spamReason`: Reason for classification
- `spamAction`: Action taken (none, quarantine, delete)
- `delivered`: Whether email was delivered to user

## Usage

### Testing the Classifier
```bash
# Start the development server
npm run dev

# Run the test script
node test-spam-filter.js
```

### Dashboard Usage
1. Navigate to the dashboard
2. Click on the "Spam Filtering" tab
3. View statistics and recent spam
4. Adjust settings as needed
5. Test classification with the test tool

### API Usage
```javascript
// Classify an email
const response = await fetch('/api/spam/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Email content here',
    subject: 'Email subject',
    sender: 'sender@example.com'
  })
});

const result = await response.json();
console.log(result.isSpam); // true/false
console.log(result.confidence); // 0-1
console.log(result.reason); // Explanation
```

## Customization

### Adding New Spam Indicators
Edit the `SpamClassifier` class in `/api/spam/classify/route.js`:

```javascript
this.spamKeywords.push('new-spam-word');
this.suspiciousPatterns.push(/new-pattern/g);
```

### Adjusting Sensitivity
Modify the threshold calculation in the webhook handler:

```javascript
const threshold = spamSettings.sensitivity === 'low' ? 0.9 : 
                 spamSettings.sensitivity === 'high' ? 0.5 : 0.7;
```

## Monitoring

### Logs
The system logs spam detection events:
```
Spam detected for alias@domain.com: promotional language, urgent call-to-action
```

### Statistics
View spam statistics in the dashboard or via API:
- Total emails processed
- Spam detection rate
- False positive/negative counts
- Accuracy percentage

## Future Enhancements

1. **Machine Learning Integration**: Replace rule-based system with ML model
2. **User Feedback**: Allow users to mark false positives/negatives
3. **Advanced Patterns**: Detect more sophisticated spam patterns
4. **Whitelist/Blacklist Management**: UI for managing trusted/blocked senders
5. **Spam Quarantine**: View and manage quarantined emails
6. **Bulk Actions**: Mark multiple emails as spam/ham

## Troubleshooting

### Common Issues

1. **Spam classification not working**:
   - Check if the API endpoint is accessible
   - Verify environment variables are set
   - Check server logs for errors

2. **False positives**:
   - Adjust sensitivity to "low"
   - Add legitimate senders to whitelist
   - Review spam keywords

3. **False negatives**:
   - Increase sensitivity to "high"
   - Add spam patterns to blacklist
   - Update spam keywords

### Debug Mode
Enable debug logging by setting:
```javascript
console.log('Spam classification result:', spamResult);
```

## Security Considerations

1. **Input Validation**: All inputs are validated and sanitized
2. **Rate Limiting**: Consider implementing rate limiting for API calls
3. **Privacy**: Spam classification data is stored securely
4. **Access Control**: Only authenticated users can access spam settings

## Performance

- Classification is performed in real-time during email processing
- Minimal impact on email delivery speed
- Statistics are calculated on-demand
- Consider caching for high-volume scenarios
