// Example of how to integrate spam filtering with email processing
// This would typically be called when emails are received via webhook

import { connectToDatabase } from '@/lib/mongodb';

export async function processIncomingEmail(emailData) {
  const { db } = await connectToDatabase();
  
  // Extract email content
  const { subject, text, sender, recipient } = emailData;
  
  // Call spam classification API
  const spamResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/spam/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, subject, sender })
  });
  
  const spamResult = await spamResponse.json();
  
  // Get user's spam settings
  const user = await db.collection('users').findOne({ email: recipient });
  const spamSettings = user?.spamSettings || {
    enabled: true,
    sensitivity: 'medium',
    autoDelete: false,
    notifications: true
  };
  
  // Apply spam filtering based on settings
  let shouldDeliver = true;
  let spamAction = 'none';
  
  if (spamSettings.enabled && spamResult.isSpam) {
    // Adjust sensitivity threshold
    const threshold = spamSettings.sensitivity === 'low' ? 0.8 : 
                     spamSettings.sensitivity === 'high' ? 0.6 : 0.7;
    
    if (spamResult.confidence >= threshold) {
      shouldDeliver = !spamSettings.autoDelete;
      spamAction = spamSettings.autoDelete ? 'delete' : 'quarantine';
    }
  }
  
  // Save email to database with spam classification
  const emailRecord = {
    userId: user._id,
    aliasEmail: recipient,
    sender: sender,
    subject: subject,
    text: text,
    receivedAt: new Date(),
    isSpam: spamResult.isSpam,
    spamConfidence: spamResult.confidence,
    spamReason: spamResult.reason,
    spamAction: spamAction,
    delivered: shouldDeliver
  };
  
  await db.collection('emails').insertOne(emailRecord);
  
  // Send notification if enabled
  if (spamSettings.notifications && spamResult.isSpam && spamAction !== 'none') {
    // Send notification to user about spam detection
    console.log(`Spam detected for ${recipient}: ${spamResult.reason}`);
  }
  
  return {
    shouldDeliver,
    spamAction,
    spamResult
  };
}

// Example usage in webhook handler
export async function handleIncomingEmailWebhook(req, res) {
  try {
    const emailData = req.body;
    const result = await processIncomingEmail(emailData);
    
    if (result.shouldDeliver) {
      // Forward email to user's real email
      // await forwardEmail(emailData);
      res.status(200).json({ status: 'delivered' });
    } else {
      // Email blocked/quarantined
      res.status(200).json({ 
        status: 'blocked', 
        reason: 'spam',
        action: result.spamAction 
      });
    }
  } catch (error) {
    console.error('Error processing incoming email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
}
