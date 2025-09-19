import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { verifyToken } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

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
        { error: 'Invalid alias ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    // Check if user is owner (for both personal and collaborative)
    const alias = await db.collection('aliases').findOne({
      _id: new ObjectId(id),
      ownerId: new ObjectId(decoded.userId)
    });

    if (!alias) {
      return NextResponse.json(
        { error: 'Alias not found or you are not the owner' },
        { status: 404 }
      );
    }

    // Delete alias (only if owner)
    const result = await db.collection('aliases').deleteOne({
      _id: new ObjectId(id),
      ownerId: new ObjectId(decoded.userId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Alias not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Alias deleted successfully' });
  } catch (error) {
    console.error('Delete alias error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}