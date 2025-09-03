import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb.js';
import { verifyToken } from '../../../lib/auth.js';
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
    
    // Get all aliases for the user, sorted by creation date
    const aliases = await db.collection('aliases')
      .find({ userId: new ObjectId(decoded.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(aliases, { status: 200 });
  } catch (error) {
    console.error('Get aliases error:', error);
    
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

export async function POST(request) {
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
    
    // Get alias data from request body
    const { alias } = await request.json();

    // Validate alias input
    if (!alias || typeof alias !== 'string') {
      return NextResponse.json(
        { error: 'Alias is required' },
        { status: 400 }
      );
    }

    // Clean and validate alias format
    const cleanAlias = alias.trim().toLowerCase();
    
    if (cleanAlias.length === 0) {
      return NextResponse.json(
        { error: 'Alias cannot be empty' },
        { status: 400 }
      );
    }

    // Check alias format (alphanumeric, dots, hyphens, underscores only)
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanAlias)) {
      return NextResponse.json(
        { error: 'Invalid alias format. Use only letters, numbers, dots, hyphens and underscores.' },
        { status: 400 }
      );
    }

    // Check length constraints
    if (cleanAlias.length < 2 || cleanAlias.length > 50) {
      return NextResponse.json(
        { error: 'Alias must be between 2 and 50 characters long' },
        { status: 400 }
      );
    }

    // Check for reserved aliases
    const reservedAliases = [
      'admin', 'administrator', 'root', 'postmaster', 'webmaster',
      'hostmaster', 'abuse', 'noreply', 'no-reply', 'support',
      'info', 'contact', 'sales', 'marketing', 'help', 'api',
      'www', 'mail', 'email', 'ftp', 'test', 'staging', 'dev'
    ];
    
    if (reservedAliases.includes(cleanAlias)) {
      return NextResponse.json(
        { error: 'This alias is reserved and cannot be used' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db();

    // Get user's real email
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId)
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Construct full alias email
    const aliasEmail = `${cleanAlias}@${process.env.MAILGUN_DOMAIN}`;

    // Check if alias already exists (globally, not just for this user)
    const existingAlias = await db.collection('aliases').findOne({
      aliasEmail: aliasEmail
    });

    if (existingAlias) {
      return NextResponse.json(
        { error: 'This alias is already taken' },
        { status: 400 }
      );
    }

    // Check user's alias limit (optional - you can set a limit)
    const userAliasCount = await db.collection('aliases').countDocuments({
      userId: new ObjectId(decoded.userId)
    });

    const maxAliases = 50; // Set your desired limit
    if (userAliasCount >= maxAliases) {
      return NextResponse.json(
        { error: `You have reached the maximum limit of ${maxAliases} aliases` },
        { status: 400 }
      );
    }

    // Create new alias
    const newAlias = {
      userId: new ObjectId(decoded.userId),
      aliasEmail: aliasEmail,
      aliasName: cleanAlias,
      realEmail: user.email,
      isActive: true,
      emailsSent: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('aliases').insertOne(newAlias);

    // Return created alias with the generated ID
    const createdAlias = {
      ...newAlias,
      _id: result.insertedId
    };

    return NextResponse.json({
      message: 'Alias created successfully',
      alias: createdAlias
    }, { status: 201 });

  } catch (error) {
    console.error('Create alias error:', error);
    
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

export async function PATCH(request) {
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
    const { aliasId, isActive } = await request.json();

    if (!aliasId || !ObjectId.isValid(aliasId)) {
      return NextResponse.json(
        { error: 'Valid alias ID is required' },
        { status: 400 }
      );
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean value' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db();

    // Update alias status (only if it belongs to the user)
    const result = await db.collection('aliases').updateOne(
      { 
        _id: new ObjectId(aliasId),
        userId: new ObjectId(decoded.userId)
      },
      { 
        $set: { 
          isActive: isActive,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Alias not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get updated alias
    const updatedAlias = await db.collection('aliases').findOne({
      _id: new ObjectId(aliasId)
    });

    return NextResponse.json({
      message: `Alias ${isActive ? 'activated' : 'deactivated'} successfully`,
      alias: updatedAlias
    }, { status: 200 });

  } catch (error) {
    console.error('Update alias error:', error);
    
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