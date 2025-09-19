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

    // Create or get reverse alias for this recipient
    const reverseAliasId = await createReverseAlias(db, alias._id, to, decoded.userId);

    // Send email via Mailgun - NO real email exposed
    const emailData = {
      from: from, // This shows as the alias email
      to: to,
      subject: subject,
      text: text,
      // CRITICAL: Use reverse alias instead of real email
      'h:Reply-To': `${reverseAliasId}@${process.env.MAILGUN_DOMAIN}`,
      'o:tracking': 'yes'
    };

    const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, emailData);

    // Log the sent email
    await db.collection('sent_emails').insertOne({
      userId: new ObjectId(decoded.userId),
      aliasId: alias._id,
      aliasEmail: from,
      reverseAliasId: reverseAliasId,
      to: to,
      subject: subject,
      text: text,
      mailgunId: response.id,
      sentAt: new Date()
    });

    // Update reverse alias usage
    await db.collection('reverse_aliases').updateOne(
      { _id: reverseAliasId },
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
      reverseAlias: `${reverseAliasId}@${process.env.MAILGUN_DOMAIN}`
    });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

// Helper function to create reverse alias
async function createReverseAlias(db, aliasId, recipientEmail, userId) {
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
  
  // Create new reverse alias
  const reverseAlias = {
    _id: reverseId,
    reverseId: reverseId,
    aliasId: aliasId,
    userId: new ObjectId(userId),
    recipientEmail: recipientEmail,
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
  // Format: ra_[8 random chars]_[timestamp]
  const randomPart = crypto.randomBytes(4).toString('hex');
  const timestampPart = Date.now().toString(36).slice(-6);
  return `ra_${randomPart}_${timestampPart}`;
}