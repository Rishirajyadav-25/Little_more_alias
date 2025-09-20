import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { mg } from '../../../../lib/mailgun';
import { ObjectId } from 'mongodb';

export async function POST(request) {
try {
    console.log('=== WEBHOOK RECEIVED ===');
    
    const contentType = request.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    let recipient, sender, subject, bodyPlain, bodyHtml, messageId;
    
    // FIXED: Handle different content types
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      // Handle form data (both multipart and urlencoded)
      const formData = await request.formData();
      
      recipient = formData.get('recipient');
      sender = formData.get('sender');
      subject = formData.get('subject') || '(No Subject)';
      bodyPlain = formData.get('body-plain') || '';
      bodyHtml = formData.get('body-html') || '';
      messageId = formData.get('Message-Id');
      
    } else if (contentType.includes('application/json')) {
      // Handle JSON data
      const jsonData = await request.json();
      
      recipient = jsonData.recipient;
      sender = jsonData.sender;
      subject = jsonData.subject || '(No Subject)';
      bodyPlain = jsonData['body-plain'] || jsonData.bodyPlain || '';
      bodyHtml = jsonData['body-html'] || jsonData.bodyHtml || '';
      messageId = jsonData['Message-Id'] || jsonData.messageId;
      
    } else {
      // FIXED: Try to parse as URL encoded text
      try {
        const text = await request.text();
        console.log('Raw webhook data:', text.substring(0, 500)); // Log first 500 chars
        
        const params = new URLSearchParams(text);
        
        recipient = params.get('recipient');
        sender = params.get('sender');
        subject = params.get('subject') || '(No Subject)';
        bodyPlain = params.get('body-plain') || '';
        bodyHtml = params.get('body-html') || '';
        messageId = params.get('Message-Id');
        
      } catch (parseError) {
        console.error('Failed to parse webhook data:', parseError);
        return NextResponse.json({ 
          error: 'Invalid webhook data format',
          contentType: contentType,
          details: parseError.message 
        }, { status: 400 });
      }
    }
    
    console.log('Parsed webhook data:', { 
      from: sender, 
      to: recipient, 
      subject,
      contentType 
    });

    if (!recipient || !sender) {
      console.log('Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields',
        received: { recipient, sender, subject }
      }, { status: 400 });
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
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

// FIXED: Handle emails sent to reverse aliases (replies from recipients)
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

  // Get the original alias with collaborator info
  const originalAlias = await db.collection('aliases').findOne({
    _id: reverseAlias.aliasId
  });

  if (!originalAlias || originalAlias.isActive === false) {
    console.log('Original alias not found or inactive');
    return NextResponse.json({ message: 'Original alias not found' }, { status: 200 });
  }

  // Store the reply in inbox for ALL alias members to see
  const emailDoc = {
    aliasId: originalAlias._id,
    userId: originalAlias.ownerId, // Primary user ID for compatibility
    aliasEmail: originalAlias.aliasEmail,
    realEmail: originalAlias.realEmail || 'unknown@example.com',
    from: sender,
    to: originalAlias.aliasEmail, // Show as sent to original alias
    subject: subject,
    bodyPlain: bodyPlain,
    bodyHtml: bodyHtml,
    isRead: false,
    isForwarded: false,
    isReverseAlias: true,
    isReplyToSent: true, // FIXED: Mark as reply to sent email
    reverseAliasId: reverseId,
    receivedAt: new Date(),
    messageId: messageId
  };

  const result = await db.collection('inbox').insertOne(emailDoc);

  // FIXED: Forward to ALL collaborative alias members, not just owner
  const forwardToUsers = [];
  
  // Add owner
  const owner = await db.collection('users').findOne({ _id: originalAlias.ownerId });
  if (owner) {
    forwardToUsers.push({
      email: owner.email,
      name: owner.name,
      role: 'owner'
    });
  }

  // FIXED: Add all collaborators who can receive emails
  if (originalAlias.isCollaborative && originalAlias.collaborators) {
    for (const collaborator of originalAlias.collaborators) {
      const collaboratorUser = await db.collection('users').findOne({ 
        _id: ObjectId.isValid(collaborator.userId) ? new ObjectId(collaborator.userId) : collaborator.userId 
      });
      
      if (collaboratorUser && (collaborator.role === 'member' || collaborator.role === 'viewer')) {
        forwardToUsers.push({
          email: collaboratorUser.email,
          name: collaboratorUser.name,
          role: collaborator.role
        });
      }
    }
  }

  // Forward the reply to all relevant users
  const forwardPromises = forwardToUsers.map(async (user) => {
    try {
      await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `${originalAlias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: user.email,
        subject: `[${originalAlias.aliasEmail}] Reply: ${subject}`,
        text: `Reply received via your alias from ${reverseAlias.recipientEmail}.\n\nFrom: ${sender}\nTo: ${originalAlias.aliasEmail}\n\n${bodyPlain}`,
        html: bodyHtml ? `
          <div style="background: #f3f4f6; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
            <p><strong>Reply received via your alias from ${reverseAlias.recipientEmail}</strong></p>
            <p><strong>From:</strong> ${sender}</p>
            <p><strong>To:</strong> ${originalAlias.aliasEmail}</p>
            <p><strong>Your role:</strong> ${user.role}</p>
          </div>
          ${bodyHtml}
        ` : undefined,
        'h:Reply-To': originalAlias.aliasEmail // FIXED: Reply to original alias, not reverse
      });
      
      console.log(`Reply forwarded to ${user.email} (${user.role})`);
    } catch (forwardError) {
      console.error(`Forward error to ${user.email}:`, forwardError.message);
    }
  });

  await Promise.all(forwardPromises);

  // Mark as forwarded
  await db.collection('inbox').updateOne(
    { _id: result.insertedId },
    { $set: { isForwarded: true, forwardedAt: new Date() } }
  );

  // Update reverse alias stats
  await db.collection('reverse_aliases').updateOne(
    { reverseId: reverseId },
    { 
      $inc: { emailsReceived: 1 },
      $set: { lastUsed: new Date() }
    }
  );

  // FIXED: Log activity for collaborative alias
  if (originalAlias.isCollaborative) {
    await db.collection('shared_activities').insertOne({
      aliasId: originalAlias._id,
      type: 'reply_received',
      userId: originalAlias.ownerId, // System action
      data: { 
        from: sender,
        to: originalAlias.aliasEmail,
        subject: subject,
        recipientEmail: reverseAlias.recipientEmail
      },
      createdAt: new Date()
    });
  }

  console.log('Reverse alias reply processed successfully');
  
  return NextResponse.json({ 
    message: 'Reverse alias reply processed successfully',
    emailId: result.insertedId.toString(),
    forwardedToUsers: forwardToUsers.length
  });
}

// Handle normal alias emails (existing functionality)
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

  // FIXED: Store email in inbox for collaborative visibility
  const emailDoc = {
    aliasId: alias._id,
    userId: alias.ownerId || alias.userId, // Support both old and new structure
    aliasEmail: recipient,
    realEmail: alias.realEmail,
    from: sender,
    to: recipient,
    subject: subject,
    bodyPlain: bodyPlain,
    bodyHtml: bodyHtml,
    isRead: false,
    isForwarded: false,
    isReverseAlias: false,
    isSentEmail: false, // This is a received email
    receivedAt: new Date(),
    messageId: messageId
  };

  const result = await db.collection('inbox').insertOne(emailDoc);

  // FIXED: Forward to all relevant users (owner + collaborators)
  const forwardToUsers = [];
  
  // Add owner
  const ownerId = alias.ownerId || alias.userId;
  let owner;
  if (ObjectId.isValid(ownerId)) {
    owner = await db.collection('users').findOne({ _id: new ObjectId(ownerId) });
  } else {
    owner = await db.collection('users').findOne({ _id: ownerId });
  }

  if (owner) {
    forwardToUsers.push({
      email: owner.email,
      name: owner.name,
      role: 'owner'
    });
  }

  // FIXED: Add collaborators for collaborative aliases
  if (alias.isCollaborative && alias.collaborators) {
    for (const collaborator of alias.collaborators) {
      const collaboratorUser = await db.collection('users').findOne({ 
        _id: ObjectId.isValid(collaborator.userId) ? new ObjectId(collaborator.userId) : collaborator.userId 
      });
      
      if (collaboratorUser && (collaborator.role === 'member' || collaborator.role === 'viewer')) {
        forwardToUsers.push({
          email: collaboratorUser.email,
          name: collaboratorUser.name,
          role: collaborator.role
        });
      }
    }
  }

  // Forward to all relevant users
  const forwardPromises = forwardToUsers.map(async (user) => {
    try {
      await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `${alias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: user.email,
        subject: `[${alias.aliasEmail}] ${subject}`,
        text: `Forwarded from: ${alias.aliasEmail}\nOriginal sender: ${sender}\nYour role: ${user.role}\n\n${bodyPlain}`,
        html: bodyHtml ? `
          <div style="background: #f3f4f6; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
            <p><strong>Forwarded from:</strong> ${alias.aliasEmail}</p>
            <p><strong>Original sender:</strong> ${sender}</p>
            <p><strong>Your role:</strong> ${user.role}</p>
          </div>
          ${bodyHtml}
        ` : undefined,
        'h:Reply-To': alias.aliasEmail // FIXED: Reply to alias, not sender
      });
      
      console.log(`Email forwarded to ${user.email} (${user.role})`);
    } catch (forwardError) {
      console.error(`Forward error to ${user.email}:`, forwardError.message);
    }
  });

  await Promise.all(forwardPromises);

  // Mark as forwarded
  await db.collection('inbox').updateOne(
    { _id: result.insertedId },
    { $set: { isForwarded: true, forwardedAt: new Date() } }
  );

  // Update alias stats
  await db.collection('aliases').updateOne(
    { _id: alias._id },
    { $inc: { emailsReceived: 1 }, $set: { updatedAt: new Date() } }
  );

  // FIXED: Log activity for collaborative alias
  if (alias.isCollaborative) {
    await db.collection('shared_activities').insertOne({
      aliasId: alias._id,
      type: 'received',
      userId: alias.ownerId || alias.userId,
      data: { 
        from: sender,
        subject: subject,
        textPreview: bodyPlain.substring(0, 100) + (bodyPlain.length > 100 ? '...' : '')
      },
      createdAt: new Date()
    });
  }

  return NextResponse.json({ 
    message: 'Email processed successfully',
    emailId: result.insertedId.toString(),
    forwardedToUsers: forwardToUsers.length
  });
}