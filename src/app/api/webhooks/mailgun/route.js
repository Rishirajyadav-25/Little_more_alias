import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { mg } from '../../../../lib/mailgun';
import crypto from 'crypto';

// Verify Mailgun webhook signature
function verifyWebhookSignature(token, timestamp, signature) {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  const encodedToken = crypto
    .createHmac('sha256', key)
    .update(timestamp.concat(token))
    .digest('hex');
  
  return encodedToken === signature;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Get webhook data
    const token = formData.get('token');
    const timestamp = formData.get('timestamp');
    const signature = formData.get('signature');
    
    // Verify webhook signature (optional but recommended)
    if (process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
      if (!verifyWebhookSignature(token, timestamp, signature)) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Extract email data
    const recipient = formData.get('recipient'); // The alias email
    const sender = formData.get('sender');
    const subject = formData.get('subject') || '(No Subject)';
    const bodyPlain = formData.get('body-plain') || '';
    const bodyHtml = formData.get('body-html') || '';
    const messageHeaders = formData.get('message-headers');
    const attachmentCount = parseInt(formData.get('attachment-count') || '0');
    
    // Parse message headers
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(messageHeaders || '[]');
    } catch (e) {
      console.log('Could not parse message headers');
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db();

    // Find the alias and associated user
    const alias = await db.collection('aliases').findOne({
      aliasEmail: recipient,
      isActive: true
    });

    if (!alias) {
      console.log(`No active alias found for: ${recipient}`);
      return NextResponse.json({ message: 'Alias not found' }, { status: 404 });
    }

    // Get user details
    const user = await db.collection('users').findOne({
      _id: alias.userId
    });

    if (!user) {
      console.log(`User not found for alias: ${recipient}`);
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Handle attachments
    const attachments = [];
    for (let i = 1; i <= attachmentCount; i++) {
      const attachmentFile = formData.get(`attachment-${i}`);
      if (attachmentFile) {
        // In production, you'd want to store these in cloud storage (AWS S3, etc.)
        // For now, we'll just store metadata
        attachments.push({
          filename: attachmentFile.name,
          contentType: attachmentFile.type,
          size: attachmentFile.size,
          // You would upload the file to cloud storage here and store the URL
          // url: await uploadToCloudStorage(attachmentFile)
        });
      }
    }

    // Store email in database
    const incomingEmail = {
      aliasId: alias._id,
      userId: alias.userId,
      aliasEmail: recipient,
      realEmail: alias.realEmail,
      from: sender,
      to: recipient,
      subject: subject,
      bodyPlain: bodyPlain,
      bodyHtml: bodyHtml,
      headers: parsedHeaders,
      attachments: attachments,
      isRead: false,
      isForwarded: false,
      receivedAt: new Date(),
      messageId: formData.get('Message-Id') || null
    };

    const result = await db.collection('inbox').insertOne(incomingEmail);
    console.log(`Email stored with ID: ${result.insertedId}`);

    // Forward email to user's real email
    try {
      await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `${alias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: user.email,
        subject: `[${alias.aliasEmail}] ${subject}`,
        text: `This email was sent to your alias: ${alias.aliasEmail}\n\nFrom: ${sender}\nSubject: ${subject}\n\n${bodyPlain}`,
        html: bodyHtml ? `
          <div style="border-left: 4px solid #3b82f6; padding-left: 16px; margin-bottom: 20px;">
            <p><strong>This email was sent to your alias:</strong> ${alias.aliasEmail}</p>
            <p><strong>From:</strong> ${sender}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          ${bodyHtml}
        ` : undefined,
        'h:Reply-To': sender,
        'o:tag': 'forwarded-email'
      });

      // Mark as forwarded
      await db.collection('inbox').updateOne(
        { _id: result.insertedId },
        { $set: { isForwarded: true, forwardedAt: new Date() } }
      );

      console.log(`Email forwarded to: ${user.email}`);
    } catch (forwardError) {
      console.error('Error forwarding email:', forwardError);
      // Don't fail the webhook if forwarding fails
    }

    return NextResponse.json({ message: 'Email processed successfully' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
