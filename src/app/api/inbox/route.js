import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb.js';
import { verifyToken } from '../../../lib/auth.js';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    console.log('=== INBOX API REQUEST ===');
    
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    const aliasFilter = searchParams.get('alias');
    const unreadOnly = searchParams.get('unread') === 'true';

    console.log('Inbox query params:', {
      userId: decoded.userId,
      page,
      limit,
      aliasFilter,
      unreadOnly
    });

    const client = await clientPromise;
    const db = client.db();

    // Fetch user's accessible alias emails (personal + collaborative)
    const accessibleAliases = await db.collection('aliases').find({
      $or: [
        { ownerId: new ObjectId(decoded.userId) },
        { 'collaborators.userId': new ObjectId(decoded.userId) }
      ]
    }).toArray();

    const userAliasEmails = accessibleAliases.map(a => a.aliasEmail);

    console.log('User accessible aliases:', userAliasEmails);

    let baseQuery;
    if (aliasFilter) {
      // Specific alias - verify access
      if (!userAliasEmails.includes(aliasFilter)) {
        return NextResponse.json({ error: 'Unauthorized access to alias' }, { status: 403 });
      }
      baseQuery = { aliasEmail: aliasFilter };
    } else {
      baseQuery = { aliasEmail: { $in: userAliasEmails } };
    }

    // Add legacy userId support
    baseQuery = {
      $or: [
        baseQuery,
        { userId: new ObjectId(decoded.userId) }
      ]
    };
    
    if (unreadOnly) {
      baseQuery.$and = baseQuery.$and || [];
      baseQuery.$and.push({ isRead: false });
    }

    console.log('Database query:', JSON.stringify(baseQuery, null, 2));

    // Get emails with pagination
    const emails = await db.collection('inbox')
      .find(baseQuery)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    console.log(`Found ${emails.length} emails`);

    // Get total count for pagination (without unread filter for total)
    let totalQuery = aliasFilter 
      ? { aliasEmail: aliasFilter }
      : { aliasEmail: { $in: userAliasEmails } };
    totalQuery = {
      $or: [
        totalQuery,
        { userId: new ObjectId(decoded.userId) }
      ]
    };
    const totalCount = await db.collection('inbox').countDocuments(totalQuery);
    const totalPages = Math.ceil(totalCount / limit);

    // Get unread count
    let unreadQuery = aliasFilter 
      ? { aliasEmail: aliasFilter, isRead: false }
      : { aliasEmail: { $in: userAliasEmails }, isRead: false };
    unreadQuery = {
      $or: [
        unreadQuery,
        { userId: new ObjectId(decoded.userId), isRead: false }
      ]
    };
    const unreadCount = await db.collection('inbox').countDocuments(unreadQuery);

    console.log('Inbox stats:', {
      totalEmails: totalCount,
      unreadEmails: unreadCount,
      currentPage: page,
      totalPages
    });

    // Debug info for troubleshooting
    const debugInfo = {
      userId: decoded.userId,
      userIdType: typeof decoded.userId,
      userAliasEmails,
      totalDocsInInbox: await db.collection('inbox').countDocuments({}),
      sampleDoc: await db.collection('inbox').findOne({}, { projection: { userId: 1, aliasEmail: 1 } })
    };

    return NextResponse.json({
      emails,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      unreadCount,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Inbox API error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Server error', 
      details: error.message 
    }, { status: 500 });
  }
}