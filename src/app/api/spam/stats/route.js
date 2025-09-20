import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(decoded.userId);

    // Get spam statistics from inbox collection
    const stats = await db.collection('inbox').aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          spamEmails: { $sum: { $cond: [{ $eq: ['$isSpam', true] }, 1, 0] } },
          hamEmails: { $sum: { $cond: [{ $eq: ['$isSpam', false] }, 1, 0] } },
          falsePositives: { $sum: { $cond: [{ $eq: ['$isSpam', true] }, { $cond: [{ $eq: ['$userMarkedAsHam', true] }, 1, 0] }, 0] } },
          falseNegatives: { $sum: { $cond: [{ $eq: ['$isSpam', false] }, { $cond: [{ $eq: ['$userMarkedAsSpam', true] }, 1, 0] }, 0] } }
        }
      }
    ]).toArray();

    // Get recent spam activity
    const recentSpam = await db.collection('inbox').find({
      userId: userId,
      isSpam: true
    }).sort({ receivedAt: -1 }).limit(10).toArray();

    // Get spam by alias
    const spamByAlias = await db.collection('inbox').aggregate([
      { $match: { userId: userId, isSpam: true } },
      {
        $group: {
          _id: '$aliasEmail',
          count: { $sum: 1 },
          lastSpam: { $max: '$receivedAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    const result = stats[0] || {
      totalEmails: 0,
      spamEmails: 0,
      hamEmails: 0,
      falsePositives: 0,
      falseNegatives: 0
    };

    // Calculate accuracy
    const totalClassified = result.spamEmails + result.hamEmails;
    const accuracy = totalClassified > 0 ? 
      ((totalClassified - result.falsePositives - result.falseNegatives) / totalClassified * 100).toFixed(1) : 100;

    // Ensure we have valid numbers
    const safeResult = {
      totalEmails: result.totalEmails || 0,
      spamEmails: result.spamEmails || 0,
      hamEmails: result.hamEmails || 0,
      falsePositives: result.falsePositives || 0,
      falseNegatives: result.falseNegatives || 0
    };

    return NextResponse.json({
      ...safeResult,
      accuracy: parseFloat(accuracy),
      recentSpam: recentSpam.map(email => ({
        id: email._id,
        subject: email.subject || 'No Subject',
        sender: email.from || email.sender || 'Unknown',
        aliasEmail: email.aliasEmail || 'Unknown',
        receivedAt: email.receivedAt || new Date(),
        confidence: email.spamConfidence || 0
      })),
      spamByAlias: spamByAlias || [],
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error fetching spam stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
