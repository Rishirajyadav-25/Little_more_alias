// app/api/debug/inbox/route.js - Debug endpoint to check inbox data
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { verifyToken } from '../../../../lib/auth.js';
import { ObjectId } from 'mongodb';

export async function GET(request) {
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

    // Get database stats
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Get inbox collection stats
    const inboxExists = collections.some(c => c.name === 'inbox');
    const totalInboxDocs = inboxExists ? await db.collection('inbox').countDocuments({}) : 0;

    // Get sample inbox documents
    const sampleInboxDocs = inboxExists ? 
      await db.collection('inbox').find({}).limit(3).toArray() : [];

    // Get user's emails with different query types
    const userEmailsWithObjectId = await db.collection('inbox').find({
      userId: new ObjectId(decoded.userId)
    }).limit(5).toArray();

    const userEmailsWithString = await db.collection('inbox').find({
      userId: decoded.userId
    }).limit(5).toArray();

    // Get user info
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId)
    });

    // Get user's aliases
    const userAliases = await db.collection('aliases').find({
      userId: new ObjectId(decoded.userId)
    }).toArray();

    return NextResponse.json({
      userId: decoded.userId,
      userEmail: user?.email,
      collections: collectionNames,
      inboxStats: {
        exists: inboxExists,
        totalDocuments: totalInboxDocs,
        sampleDocuments: sampleInboxDocs.map(doc => ({
          _id: doc._id,
          userId: doc.userId,
          userIdType: typeof doc.userId,
          from: doc.from,
          to: doc.to,
          aliasEmail: doc.aliasEmail,
          subject: doc.subject,
          receivedAt: doc.receivedAt
        }))
      },
      userEmails: {
        withObjectIdUserId: userEmailsWithObjectId.length,
        withStringUserId: userEmailsWithString.length
      },
      userAliases: userAliases.map(alias => ({
        aliasEmail: alias.aliasEmail,
        isActive: alias.isActive
      }))
    });

  } catch (error) {
    console.error('Debug inbox error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
