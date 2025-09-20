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
    // NEW: Add mailType filter for sent/received
    const mailType = searchParams.get('type') || 'all'; // 'sent', 'received', 'all'

    console.log('Inbox query params:', {
      userId: decoded.userId,
      page,
      limit,
      aliasFilter,
      unreadOnly,
      mailType
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

    // FIXED: Add mail type filtering
    if (mailType === 'sent') {
      // Show only sent emails (emails sent BY the user or collaborators)
      baseQuery.isSentEmail = true;
    } else if (mailType === 'received') {
      // Show only received emails (emails sent TO the alias from external sources)
      baseQuery.$and = baseQuery.$and || [];
      baseQuery.$and.push({
        $or: [
          { isSentEmail: { $exists: false } },
          { isSentEmail: false }
        ]
      });
    }

    // Add legacy userId support for backward compatibility
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

    // Get emails with pagination and populate sender info for sent emails
    const emails = await db.collection('inbox').aggregate([
      { $match: baseQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'sentBy',
          foreignField: '_id',
          as: 'senderInfo',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $addFields: {
          senderName: { $first: '$senderInfo.name' }
        }
      },
      {
        $project: {
          senderInfo: 0
        }
      },
      { $sort: { receivedAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]).toArray();

    console.log(`Found ${emails.length} emails`);

    // Get total count for pagination (without unread filter for total)
    let totalQuery = aliasFilter 
      ? { aliasEmail: aliasFilter }
      : { aliasEmail: { $in: userAliasEmails } };
    
    // Apply mail type filter to total count
    if (mailType === 'sent') {
      totalQuery.isSentEmail = true;
    } else if (mailType === 'received') {
      totalQuery.$and = totalQuery.$and || [];
      totalQuery.$and.push({
        $or: [
          { isSentEmail: { $exists: false } },
          { isSentEmail: false }
        ]
      });
    }
    
    totalQuery = {
      $or: [
        totalQuery,
        { userId: new ObjectId(decoded.userId) }
      ]
    };
    const totalCount = await db.collection('inbox').countDocuments(totalQuery);
    const totalPages = Math.ceil(totalCount / limit);

    // Get unread count with mail type filter
    let unreadQuery = aliasFilter 
      ? { aliasEmail: aliasFilter, isRead: false }
      : { aliasEmail: { $in: userAliasEmails }, isRead: false };
    
    if (mailType === 'sent') {
      unreadQuery.isSentEmail = true;
    } else if (mailType === 'received') {
      unreadQuery.$and = unreadQuery.$and || [];
      unreadQuery.$and.push({
        $or: [
          { isSentEmail: { $exists: false } },
          { isSentEmail: false }
        ]
      });
    }
    
    unreadQuery = {
      $or: [
        unreadQuery,
        { userId: new ObjectId(decoded.userId), isRead: false }
      ]
    };
    const unreadCount = await db.collection('inbox').countDocuments(unreadQuery);

    // Get counts for different mail types
    const sentCount = await db.collection('inbox').countDocuments({
      $or: [
        { aliasEmail: { $in: userAliasEmails }, isSentEmail: true },
        { userId: new ObjectId(decoded.userId), isSentEmail: true }
      ]
    });

    const receivedCount = await db.collection('inbox').countDocuments({
      $or: [
        { 
          aliasEmail: { $in: userAliasEmails }, 
          $or: [
            { isSentEmail: { $exists: false } },
            { isSentEmail: false }
          ]
        },
        { 
          userId: new ObjectId(decoded.userId),
          $or: [
            { isSentEmail: { $exists: false } },
            { isSentEmail: false }
          ]
        }
      ]
    });

    console.log('Inbox stats:', {
      totalEmails: totalCount,
      sentEmails: sentCount,
      receivedEmails: receivedCount,
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
      mailType,
      sentCount,
      receivedCount
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
      counts: {
        total: totalCount,
        sent: sentCount,
        received: receivedCount,
        unread: unreadCount
      },
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