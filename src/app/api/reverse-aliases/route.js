import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { verifyToken } from '../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const client = await clientPromise;
    const db = client.db();

    // Fetch accessible alias IDs
    const accessibleAliasIds = await db.collection('aliases').distinct('_id', { 
      $or: [
        { ownerId: new ObjectId(decoded.userId) },
        { 'collaborators.userId': new ObjectId(decoded.userId) }
      ] 
    });

    // Get all reverse aliases for accessible aliases
    const reverseAliases = await db.collection('reverse_aliases').aggregate([
      { 
        $match: { 
          isActive: true,
          aliasId: { $in: accessibleAliasIds.map(id => new ObjectId(id)) }
        } 
      },
      {
        $lookup: {
          from: 'aliases',
          localField: 'aliasId',
          foreignField: '_id',
          as: 'alias'
        }
      },
      { $unwind: '$alias' },
      { 
        $sort: { lastUsed: -1 } 
      }
    ]).toArray();

    return NextResponse.json(reverseAliases);
  } catch (error) {
    console.error('Get reverse aliases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Deactivate reverse alias (any accessible user can deactivate for shared aliases)
export async function DELETE(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const { reverseId } = await request.json();

    if (!reverseId) {
      return NextResponse.json({ error: 'Reverse ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Fetch the reverse alias
    const reverseAlias = await db.collection('reverse_aliases').findOne({
      reverseId: reverseId,
      isActive: true
    });

    if (!reverseAlias) {
      return NextResponse.json({ error: 'Reverse alias not found' }, { status: 404 });
    }

    // Verify access to the alias
    const accessibleAliasIds = await db.collection('aliases').distinct('_id', { 
      $or: [
        { ownerId: new ObjectId(decoded.userId) },
        { 'collaborators.userId': new ObjectId(decoded.userId) }
      ] 
    });

    if (!accessibleAliasIds.some(id => id.toString() === reverseAlias.aliasId.toString())) {
      return NextResponse.json({ error: 'Unauthorized access to reverse alias' }, { status: 403 });
    }

    const result = await db.collection('reverse_aliases').updateOne(
      { 
        reverseId: reverseId,
        isActive: true
      },
      { 
        $set: { 
          isActive: false,
          deactivatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Reverse alias not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reverse alias deactivated' });
  } catch (error) {
    console.error('Delete reverse alias error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}