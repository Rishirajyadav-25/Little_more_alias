import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { verifyToken } from '../../../../lib/auth.js';
import { ObjectId } from 'mongodb';

export async function GET(request, { params }) {
  try {
    console.log('=== SINGLE EMAIL REQUEST ===');
    
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    const { id } = await params;

    console.log('Fetching email:', { emailId: id, userId: decoded.userId });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid email ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // First, fetch the email
    let email = await db.collection('inbox').findOne({
      _id: new ObjectId(id),
      $or: [
        { userId: new ObjectId(decoded.userId) },
        { userId: decoded.userId } // Legacy string
      ]
    });

    if (!email) {
      // Try without userId filter first, then verify access
      email = await db.collection('inbox').findOne({ _id: new ObjectId(id) });
      
      if (!email) {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        );
      }

      // Verify access via aliasEmail
      const accessibleAliases = await db.collection('aliases').find({
        $or: [
          { ownerId: new ObjectId(decoded.userId) },
          { 'collaborators.userId': new ObjectId(decoded.userId) }
        ]
      }).toArray();

      const userAliasEmails = accessibleAliases.map(a => a.aliasEmail);

      if (!userAliasEmails.includes(email.aliasEmail)) {
        return NextResponse.json(
          { error: 'Unauthorized access to email' },
          { status: 403 }
        );
      }
    }

    console.log('Email found:', { from: email.from, subject: email.subject });

    return NextResponse.json(email);

  } catch (error) {
    console.error('Get email error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    const { id } = await params;
    const { isRead } = await request.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid email ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // First, fetch to verify access
    let email = await db.collection('inbox').findOne({
      _id: new ObjectId(id),
      $or: [
        { userId: new ObjectId(decoded.userId) },
        { userId: decoded.userId }
      ]
    });

    if (!email) {
      email = await db.collection('inbox').findOne({ _id: new ObjectId(id) });
      if (!email) {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        );
      }

      // Verify access
      const accessibleAliases = await db.collection('aliases').find({
        $or: [
          { ownerId: new ObjectId(decoded.userId) },
          { 'collaborators.userId': new ObjectId(decoded.userId) }
        ]
      }).toArray();

      const userAliasEmails = accessibleAliases.map(a => a.aliasEmail);

      if (!userAliasEmails.includes(email.aliasEmail)) {
        return NextResponse.json(
          { error: 'Unauthorized access to email' },
          { status: 403 }
        );
      }
    }

    // Update (shared isRead for simplicity)
    let result = await db.collection('inbox').updateOne(
      {
        _id: new ObjectId(id),
        $or: [
          { userId: new ObjectId(decoded.userId) },
          { userId: decoded.userId }
        ]
      },
      {
        $set: {
          isRead: isRead,
          readAt: isRead ? new Date() : null
        }
      }
    );

    // If no match with userId, try direct (for shared)
    if (result.matchedCount === 0) {
      result = await db.collection('inbox').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            isRead: isRead,
            readAt: isRead ? new Date() : null
          }
        }
      );
    }

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Email updated successfully' });

  } catch (error) {
    console.error('Update email error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid email ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // Fetch to verify access
    let email = await db.collection('inbox').findOne({
      _id: new ObjectId(id),
      $or: [
        { userId: new ObjectId(decoded.userId) },
        { userId: decoded.userId }
      ]
    });

    if (!email) {
      email = await db.collection('inbox').findOne({ _id: new ObjectId(id) });
      if (!email) {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        );
      }

      // Verify access
      const accessibleAliases = await db.collection('aliases').find({
        $or: [
          { ownerId: new ObjectId(decoded.userId) },
          { 'collaborators.userId': new ObjectId(decoded.userId) }
        ]
      }).toArray();

      const userAliasEmails = accessibleAliases.map(a => a.aliasEmail);

      if (!userAliasEmails.includes(email.aliasEmail)) {
        return NextResponse.json(
          { error: 'Unauthorized access to email' },
          { status: 403 }
        );
      }
    }

    // Try both ObjectId and string userId for compatibility
    let result = await db.collection('inbox').deleteOne({
      _id: new ObjectId(id),
      $or: [
        { userId: new ObjectId(decoded.userId) },
        { userId: decoded.userId }
      ]
    });

    // If no match with userId, try direct (for shared)
    if (result.deletedCount === 0) {
      result = await db.collection('inbox').deleteOne({
        _id: new ObjectId(id)
      });
    }

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Email deleted successfully' });

  } catch (error) {
    console.error('Delete email error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}