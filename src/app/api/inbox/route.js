// import { NextResponse } from 'next/server';
// import clientPromise from '../../../lib/mongodb.js';
// import { verifyToken } from '../../../lib/auth.js';
// import { ObjectId } from 'mongodb';

// export async function GET(request, { params }) {
//   try {
//     const token = request.cookies.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json(
//         { error: 'Not authenticated' },
//         { status: 401 }
//       );
//     }

//     const decoded = verifyToken(token);
//     const { id } = await params;

//     if (!ObjectId.isValid(id)) {
//       return NextResponse.json(
//         { error: 'Invalid email ID' },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db();

//     const email = await db.collection('inbox').findOne({
//       _id: new ObjectId(id),
//       userId: new ObjectId(decoded.userId)
//     });

//     if (!email) {
//       return NextResponse.json(
//         { error: 'Email not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json(email);

//   } catch (error) {
//     console.error('Get email error:', error);
    
//     if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
//       return NextResponse.json(
//         { error: 'Invalid or expired token' },
//         { status: 401 }
//       );
//     }
    
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }

// export async function PATCH(request, { params }) {
//   try {
//     const token = request.cookies.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json(
//         { error: 'Not authenticated' },
//         { status: 401 }
//       );
//     }

//     const decoded = verifyToken(token);
//     const { id } = params;
//     const { isRead } = await request.json();

//     if (!ObjectId.isValid(id)) {
//       return NextResponse.json(
//         { error: 'Invalid email ID' },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db();

//     const result = await db.collection('inbox').updateOne(
//       {
//         _id: new ObjectId(id),
//         userId: new ObjectId(decoded.userId)
//       },
//       {
//         $set: {
//           isRead: isRead,
//           readAt: isRead ? new Date() : null
//         }
//       }
//     );

//     if (result.matchedCount === 0) {
//       return NextResponse.json(
//         { error: 'Email not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({ message: 'Email updated successfully' });

//   } catch (error) {
//     console.error('Update email error:', error);
    
//     if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
//       return NextResponse.json(
//         { error: 'Invalid or expired token' },
//         { status: 401 }
//       );
//     }
    
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }

// export async function DELETE(request, { params }) {
//   try {
//     const token = request.cookies.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json(
//         { error: 'Not authenticated' },
//         { status: 401 }
//       );
//     }

//     const decoded = verifyToken(token);
//     const { id } = params;

//     if (!ObjectId.isValid(id)) {
//       return NextResponse.json(
//         { error: 'Invalid email ID' },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db();

//     const result = await db.collection('inbox').deleteOne({
//       _id: new ObjectId(id),
//       userId: new ObjectId(decoded.userId)
//     });

//     if (result.deletedCount === 0) {
//       return NextResponse.json(
//         { error: 'Email not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({ message: 'Email deleted successfully' });

//   } catch (error) {
//     console.error('Delete email error:', error);
    
//     if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
//       return NextResponse.json(
//         { error: 'Invalid or expired token' },
//         { status: 401 }
//       );
//     }
    
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }





















// Fix 1: app/api/inbox/route.js (Remove the id destructuring)
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb.js';
import { verifyToken } from '../../../lib/auth.js';
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
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const aliasFilter = searchParams.get('alias');
    const unreadOnly = searchParams.get('unread') === 'true';

    const client = await clientPromise;
    const db = client.db();

    // Build query
    const query = { userId: new ObjectId(decoded.userId) };
    
    if (aliasFilter) {
      query.aliasEmail = aliasFilter;
    }
    
    if (unreadOnly) {
      query.isRead = false;
    }

    // Get emails with pagination
    const emails = await db.collection('inbox')
      .find(query)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('inbox').countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get unread count
    const unreadCount = await db.collection('inbox').countDocuments({
      userId: new ObjectId(decoded.userId),
      isRead: false
    });

    return NextResponse.json({
      emails,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      unreadCount
    });

  } catch (error) {
    console.error('Get inbox error:', error);
    
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