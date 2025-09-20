import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { verifyToken } from '../../../lib/auth';
import { mg } from '../../../lib/mailgun';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    const { from, to, subject, text } = await request.json();

    if (!from || !to || !subject || !text) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // Verify that the alias belongs to the user (personal or collaborative access)
    const alias = await db.collection('aliases').findOne({
      aliasEmail: from,
      $or: [
        { ownerId: new ObjectId(decoded.userId) },
        { 'collaborators.userId': new ObjectId(decoded.userId) }
      ]
    });

    if (!alias) {
      return NextResponse.json(
        { error: 'Alias not found or unauthorized' },
        { status: 403 }
      );
    }

    // Check permissions for sending (owners/members only for collaborative)
    let userRole = 'owner';
    if (alias.ownerId.toString() !== decoded.userId) {
      const collaborator = alias.collaborators.find(c => c.userId.toString() === decoded.userId);
      userRole = collaborator ? collaborator.role : null;
    }

    if (alias.isCollaborative && userRole !== 'owner' && userRole !== 'member') {
      return NextResponse.json(
        { error: 'Insufficient permissions to send from this collaborative alias' },
        { status: 403 }
      );
    }

    // Create or get reverse alias for this recipient - FIX: Use the original alias email
    const reverseAliasId = await createReverseAlias(db, alias._id, to, decoded.userId, from);

    // Send email via Mailgun
    const emailData = {
      from: from, // This shows as the alias email
      to: to,
      subject: subject,
      text: text,
      // FIXED: Use the original alias email instead of random reverse alias
      'h:Reply-To': from, // Recipients will reply to the original alias
      'o:tracking': 'yes'
    };

    const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, emailData);

    // Log the sent email in inbox for collaborative visibility
    await db.collection('inbox').insertOne({
      aliasId: alias._id,
      userId: new ObjectId(decoded.userId),
      aliasEmail: from,
      realEmail: (await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) })).email,
      from: from,
      to: to,
      subject: subject,
      bodyPlain: text,
      isRead: true,
      isForwarded: false,
      isSentEmail: true, // Mark as sent email
      sentBy: new ObjectId(decoded.userId),
      receivedAt: new Date(),
      messageId: response.id
    });

    // Update reverse alias usage
    await db.collection('reverse_aliases').updateOne(
      { reverseId: reverseAliasId },
      { 
        $inc: { emailsSent: 1 },
        $set: { lastUsed: new Date() }
      }
    );

    // Update alias stats
    await db.collection('aliases').updateOne(
      { _id: alias._id },
      { $inc: { emailsSent: 1 }, $set: { updatedAt: new Date() } }
    );

    // Log activity if collaborative
    if (alias.isCollaborative) {
      await db.collection('shared_activities').insertOne({
        aliasId: alias._id,
        type: 'sent',
        userId: new ObjectId(decoded.userId),
        data: { 
          to, 
          subject, 
          textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '') 
        },
        createdAt: new Date()
      });
    }

    return NextResponse.json({
      message: 'Email sent successfully',
      messageId: response.id,
      reverseAlias: from // Return the original alias instead of reverse alias
    });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

// FIXED: Helper function to create reverse alias with original alias email
async function createReverseAlias(db, aliasId, recipientEmail, userId, originalAliasEmail) {
  // Check if reverse alias already exists for this combination
  let existingReverse = await db.collection('reverse_aliases').findOne({
    aliasId: aliasId,
    recipientEmail: recipientEmail
  });

  if (existingReverse) {
    return existingReverse.reverseId;
  }

  // Generate unique reverse alias ID
  const reverseId = generateReverseId();
  
  // Create new reverse alias with original alias email reference
  const reverseAlias = {
    _id: reverseId,
    reverseId: reverseId,
    aliasId: aliasId,
    userId: new ObjectId(userId),
    recipientEmail: recipientEmail,
    originalAliasEmail: originalAliasEmail, // Store the original alias email
    emailsSent: 0,
    emailsReceived: 0,
    createdAt: new Date(),
    lastUsed: new Date(),
    isActive: true
  };

  await db.collection('reverse_aliases').insertOne(reverseAlias);
  return reverseId;
}

// Generate unique reverse alias ID
function generateReverseId() {
  const randomPart = crypto.randomBytes(4).toString('hex');
  const timestampPart = Date.now().toString(36).slice(-6);
  return `ra_${randomPart}_${timestampPart}`;
}