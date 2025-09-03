import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { verifyToken } from '../../../lib/auth';
import { mg } from '../../../lib/mailgun';
import { ObjectId } from 'mongodb';

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

    // Verify that the alias belongs to the user
    const alias = await db.collection('aliases').findOne({
      aliasEmail: from,
      userId: new ObjectId(decoded.userId)
    });

    if (!alias) {
      return NextResponse.json(
        { error: 'Alias not found or unauthorized' },
        { status: 403 }
      );
    }

    // Send email via Mailgun
    const emailData = {
      from: from, // This will show as the alias email
      to: to,
      subject: subject,
      text: text,
      'h:Reply-To': alias.realEmail, // Set reply-to as the real email
      'o:tracking': 'yes'
    };

    const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, emailData);

    // Log the sent email
    await db.collection('sent_emails').insertOne({
      userId: new ObjectId(decoded.userId),
      aliasEmail: from,
      realEmail: alias.realEmail,
      to: to,
      subject: subject,
      text: text,
      mailgunId: response.id,
      sentAt: new Date()
    });

    return NextResponse.json({
      message: 'Email sent successfully',
      messageId: response.id
    });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
