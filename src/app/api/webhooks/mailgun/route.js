// ===== 2. Update your Mailgun webhook to handle reverse aliases and spam filtering =====
// app/api/webhooks/mailgun/route.js - UPDATED to handle reverse aliases and spam filtering

import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

export async function POST(request) {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    
    const formData = await request.formData();
    
    const recipient = formData.get('recipient');
    const sender = formData.get('sender');
    const subject = formData.get('subject') || '(No Subject)';
    const bodyPlain = formData.get('body-plain') || '';
    const bodyHtml = formData.get('body-html') || '';
    const messageId = formData.get('Message-Id');
    
    console.log('Email received:', { from: sender, to: recipient, subject });

    if (!recipient || !sender) {
      console.log('Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Extract local part (before @) to check if it's a reverse alias
    const [localPart] = recipient.split('@');
    
    // Check if this is a reverse alias (starts with 'ra_')
    if (localPart.startsWith('ra_')) {
      return await handleReverseAliasEmail(db, localPart, sender, subject, bodyPlain, bodyHtml, messageId);
    }

    // Handle normal alias forwarding (existing logic)
    return await handleNormalAliasEmail(db, recipient, sender, subject, bodyPlain, bodyHtml, messageId);

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
  }
}

// Handle emails sent to reverse aliases (replies from recipients)
async function handleReverseAliasEmail(db, reverseId, sender, subject, bodyPlain, bodyHtml, messageId) {
  console.log('Processing reverse alias email:', reverseId);

  // Find the reverse alias
  const reverseAlias = await db.collection('reverse_aliases').findOne({
    reverseId: reverseId,
    isActive: true
  });

  if (!reverseAlias) {
    console.log('Reverse alias not found:', reverseId);
    return NextResponse.json({ message: 'Reverse alias not found' }, { status: 200 });
  }

  // Get the original alias
  const originalAlias = await db.collection('aliases').findOne({
    _id: reverseAlias.aliasId
  });

  if (!originalAlias || originalAlias.isActive === false) {
    console.log('Original alias not found or inactive');
    return NextResponse.json({ message: 'Original alias not found' }, { status: 200 });
  }

  // Get user
  const user = await db.collection('users').findOne({
    _id: ObjectId.isValid(originalAlias.userId) ? new ObjectId(originalAlias.userId) : originalAlias.userId
  });

  if (!user) {
    console.log('User not found');
    return NextResponse.json({ message: 'User not found' }, { status: 200 });
  }

  console.log('Forwarding reverse alias email to user:', user.email);

  // Store in inbox (appears as if sent to the original alias)
  const emailDoc = {
    aliasId: originalAlias._id,
    userId: originalAlias.userId,
    aliasEmail: originalAlias.aliasEmail,
    realEmail: user.email,
    from: sender,
    to: originalAlias.aliasEmail, // Show as sent to original alias
    subject: subject,
    bodyPlain: bodyPlain,
    bodyHtml: bodyHtml,
    isRead: false,
    isForwarded: false,
    isReverseAlias: true,
    reverseAliasId: reverseId,
    receivedAt: new Date(),
    messageId: messageId
  };

  const result = await db.collection('inbox').insertOne(emailDoc);

  // Forward to user's real email
  try {
    await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `${originalAlias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
      to: user.email,
      subject: `[${originalAlias.aliasEmail}] ${subject}`,
      text: `Reply received via your alias.\nFrom: ${sender}\nTo: ${originalAlias.aliasEmail}\n\n${bodyPlain}`,
      html: bodyHtml ? `
        <div style="background: #f3f4f6; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
          <p><strong>Reply received via your alias</strong></p>
          <p><strong>From:</strong> ${sender}</p>
          <p><strong>To:</strong> ${originalAlias.aliasEmail}</p>
        </div>
        ${bodyHtml}
      ` : undefined,
      'h:Reply-To': `${reverseId}@${process.env.MAILGUN_DOMAIN}` // Keep using reverse alias
    });

    await db.collection('inbox').updateOne(
      { _id: result.insertedId },
      { $set: { isForwarded: true, forwardedAt: new Date() } }
    );

    // Update reverse alias stats
    await db.collection('reverse_aliases').updateOne(
      { _id: reverseId },
      { 
        $inc: { emailsReceived: 1 },
        $set: { lastUsed: new Date() }
      }
    );

    console.log('Reverse alias email processed successfully');
    
  } catch (forwardError) {
    console.error('Forward error:', forwardError.message);
  }

  return NextResponse.json({ 
    message: 'Reverse alias email processed successfully',
    emailId: result.insertedId.toString()
  });
}

// Handle normal alias emails with spam filtering
async function handleNormalAliasEmail(db, recipient, sender, subject, bodyPlain, bodyHtml, messageId) {
  const alias = await db.collection('aliases').findOne({
    $and: [
      {
        $or: [
          { aliasEmail: recipient },
          { aliasEmail: recipient.toLowerCase() }
        ]
      },
      {
        $or: [
          { isActive: true },
          { isActive: { $exists: false } }
        ]
      }
    ]
  });

  if (!alias) {
    console.log('No active alias found for:', recipient);
    return NextResponse.json({ message: 'No active alias found' }, { status: 200 });
  }

  let user;
  if (ObjectId.isValid(alias.userId)) {
    user = await db.collection('users').findOne({ _id: new ObjectId(alias.userId) });
  } else {
    user = await db.collection('users').findOne({ _id: alias.userId });
  }

  if (!user) {
    console.log('No user found for alias');
    return NextResponse.json({ message: 'No user found' }, { status: 200 });
  }

  // Get user's spam settings
  const spamSettings = user.spamSettings || {
    enabled: true,
    sensitivity: 'medium',
    autoDelete: false,
    notifications: true
  };

  // Perform spam classification if enabled
  let spamResult = null;
  let shouldDeliver = true;
  let spamAction = 'none';

  if (spamSettings.enabled) {
    try {
      const spamResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/spam/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: bodyPlain, 
          subject: subject, 
          sender: sender 
        })
      });

      if (spamResponse.ok) {
        spamResult = await spamResponse.json();
        
        // Apply spam filtering based on settings
        const threshold = spamSettings.sensitivity === 'low' ? 0.8 : 
                         spamSettings.sensitivity === 'high' ? 0.6 : 0.7;
        
        if (spamResult.isSpam && spamResult.confidence >= threshold) {
          shouldDeliver = !spamSettings.autoDelete;
          spamAction = spamSettings.autoDelete ? 'delete' : 'quarantine';
          console.log(`Spam detected for ${recipient}: ${spamResult.reason}`);
        }
      }
    } catch (spamError) {
      console.error('Spam classification error:', spamError);
      // Continue processing if spam classification fails
    }
  }

  const emailDoc = {
    aliasId: alias._id,
    userId: alias.userId,
    aliasEmail: recipient,
    realEmail: user.email,
    from: sender,
    to: recipient,
    subject: subject,
    bodyPlain: bodyPlain,
    bodyHtml: bodyHtml,
    isRead: false,
    isForwarded: false,
    isReverseAlias: false,
    receivedAt: new Date(),
    messageId: messageId,
    // Spam classification data
    isSpam: spamResult?.isSpam || false,
    spamConfidence: spamResult?.confidence || 0,
    spamReason: spamResult?.reason || '',
    spamAction: spamAction,
    delivered: shouldDeliver
  };

  const result = await db.collection('inbox').insertOne(emailDoc);

  // Only forward if not blocked by spam filter
  if (shouldDeliver) {
    try {
      await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `${alias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: user.email,
        subject: `[${alias.aliasEmail}] ${subject}`,
        text: `Forwarded from: ${alias.aliasEmail}\nOriginal sender: ${sender}\n\n${bodyPlain}`,
        html: bodyHtml ? `
          <div style="background: #f3f4f6; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
            <p><strong>Forwarded from:</strong> ${alias.aliasEmail}</p>
            <p><strong>Original sender:</strong> ${sender}</p>
          </div>
          ${bodyHtml}
        ` : undefined,
        'h:Reply-To': sender
      });

      await db.collection('inbox').updateOne(
        { _id: result.insertedId },
        { $set: { isForwarded: true, forwardedAt: new Date() } }
      );

    } catch (forwardError) {
      console.error('Forward error:', forwardError.message);
    }
  } else {
    console.log(`Email blocked due to spam: ${spamResult?.reason}`);
    
    // Send notification if enabled
    if (spamSettings.notifications && spamAction !== 'delete') {
      try {
        await mg.messages.create(process.env.MAILGUN_DOMAIN, {
          from: `Spam Filter <noreply@${process.env.MAILGUN_DOMAIN}>`,
          to: user.email,
          subject: `Spam Email Blocked for ${alias.aliasEmail}`,
          text: `A potential spam email was blocked for your alias ${alias.aliasEmail}.\n\nFrom: ${sender}\nSubject: ${subject}\nReason: ${spamResult?.reason}\n\nYou can view and manage spam settings in your dashboard.`,
          html: `
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <h3 style="color: #dc2626; margin: 0 0 8px 0;">🚫 Spam Email Blocked</h3>
              <p style="margin: 0; color: #7f1d1d;">A potential spam email was blocked for your alias <strong>${alias.aliasEmail}</strong>.</p>
            </div>
            <div style="background: #f9fafb; padding: 12px; border-radius: 6px;">
              <p><strong>From:</strong> ${sender}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Reason:</strong> ${spamResult?.reason}</p>
            </div>
            <p style="margin-top: 16px; color: #6b7280;">You can view and manage spam settings in your dashboard.</p>
          `
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError.message);
      }
    }
  }

  return NextResponse.json({ 
    message: shouldDeliver ? 'Email processed successfully' : 'Email blocked as spam',
    emailId: result.insertedId.toString(),
    spamDetected: spamResult?.isSpam || false,
    spamAction: spamAction
  });
}
