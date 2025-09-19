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

    // Fetch accessible collaborative alias IDs (only collaborative have activities)
    const accessibleCollaborativeAliasIds = await db.collection('aliases').distinct('_id', { 
      $or: [
        { ownerId: new ObjectId(decoded.userId), isCollaborative: true },
        { 'collaborators.userId': new ObjectId(decoded.userId), isCollaborative: true }
      ] 
    });

    if (accessibleCollaborativeAliasIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get activities for accessible collaborative aliases
    const activities = await db.collection('shared_activities')
      .find({ 
        aliasId: { $in: accessibleCollaborativeAliasIds.map(id => new ObjectId(id)) } 
      })
      .sort({ createdAt: -1 })
      .limit(100) // Reasonable limit
      .toArray();

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Get shared activities error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}