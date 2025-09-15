// app/api/debug/create-test-email/route.js - Create test email in inbox
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { verifyToken } from '../../../../lib/auth.js';
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
    const client = await clientPromise;
    const db = client.db();

    // Get user details
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId)
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's first alias
    const alias = await db.collection('aliases').findOne({
      userId: new ObjectId(decoded.userId)
    });

    if (!alias) {
      return NextResponse.json(
        { error: 'No alias found. Create an alias first.' },
        { status: 400 }
      );
    }

    // Create test email
    const testEmail = {
      aliasId: alias._id,
      userId: alias.userId, // This will be ObjectId from alias
      aliasEmail: alias.aliasEmail,
      realEmail: user.email,
      from: 'test@example.com',
      to: alias.aliasEmail,
      subject: 'Test Email - ' + new Date().toISOString(),
      bodyPlain: 'This is a test email created to verify the inbox functionality.',
      bodyHtml: '<p>This is a test email created to verify the inbox functionality.</p>',
      headers: [],
      attachments: [],
      isRead: false,
      isForwarded: false,
      receivedAt: new Date(),
      messageId: 'test-' + Date.now() + '@example.com'
    };

    const result = await db.collection('inbox').insertOne(testEmail);

    return NextResponse.json({
      message: 'Test email created successfully',
      emailId: result.insertedId,
      testEmail: {
        from: testEmail.from,
        to: testEmail.aliasEmail,
        subject: testEmail.subject,
        userId: testEmail.userId,
        userIdType: typeof testEmail.userId
      }
    });

  } catch (error) {
    console.error('Create test email error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}