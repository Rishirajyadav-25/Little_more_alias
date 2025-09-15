// import { NextResponse } from 'next/server';
// import clientPromise from '../../../lib/mongodb';
// import { verifyToken } from '../../../lib/auth';
// import { ObjectId } from 'mongodb';

// export async function GET(request) {
//   try {
//     const token = request.cookies.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json(
//         { error: 'Not authenticated' },
//         { status: 401 }
//       );
//     }

//     const decoded = verifyToken(token);
    
//     const client = await clientPromise;
//     const db = client.db();
    
//     const aliases = await db.collection('aliases').find({
//       userId: new ObjectId(decoded.userId)
//     }).toArray();

//     return NextResponse.json(aliases);
//   } catch (error) {
//     console.error('Get aliases error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(request) {
//   try {
//     const token = request.cookies.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json(
//         { error: 'Not authenticated' },
//         { status: 401 }
//       );
//     }

//     const decoded = verifyToken(token);
//     const { alias } = await request.json();

//     if (!alias || !/^[a-zA-Z0-9._-]+$/.test(alias)) {
//       return NextResponse.json(
//         { error: 'Invalid alias format. Use only letters, numbers, dots, hyphens and underscores.' },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db();

//     // Get user's real email
//     const user = await db.collection('users').findOne({
//       _id: new ObjectId(decoded.userId)
//     });

//     if (!user) {
//       return NextResponse.json(
//         { error: 'User not found' },
//         { status: 404 }
//       );
//     }

//     const aliasEmail = `${alias}@${process.env.MAILGUN_DOMAIN}`;

//     // Check if alias already exists
//     const existingAlias = await db.collection('aliases').findOne({
//       aliasEmail: aliasEmail
//     });

//     if (existingAlias) {
//       return NextResponse.json(
//         { error: 'Alias already exists' },
//         { status: 400 }
//       );
//     }

//     // Create alias
//     const result = await db.collection('aliases').insertOne({
//       userId: new ObjectId(decoded.userId),
//       aliasEmail: aliasEmail,
//       realEmail: user.email,
//       createdAt: new Date()
//     });

//     return NextResponse.json(
//       { 
//         message: 'Alias created successfully',
//         aliasId: result.insertedId,
//         aliasEmail: aliasEmail
//       },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error('Create alias error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }






import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { verifyToken } from '../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    // Get token from cookies
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify and decode token
    const decoded = verifyToken(token);
    
    // Connect to database
    const client = await clientPromise;
    const db = client.db();
    
    // Find user by ID, exclude password field
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(decoded.userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('Get user error:', error);
    
    // Handle JWT errors specifically
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

export async function PUT(request) {
  try {
    // Get token from cookies
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify and decode token
    const decoded = verifyToken(token);
    
    // Get update data from request body
    const { name } = await request.json();
    
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db();
    
    // Update user
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(decoded.userId) },
      { 
        $set: { 
          name: name.trim(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get updated user data
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(decoded.userId) },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser
    }, { status: 200 });
  } catch (error) {
    console.error('Update user error:', error);
    
    // Handle JWT errors specifically
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