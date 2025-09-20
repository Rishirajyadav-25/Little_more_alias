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

    // Get user's spam filtering settings
    const user = await db.collection('users').findOne({ _id: userId });
    
    const defaultSettings = {
      enabled: true,
      sensitivity: 'medium', // low, medium, high
      autoDelete: false,
      quarantineFolder: 'spam',
      whitelist: [],
      blacklist: [],
      notifications: true,
      stats: {
        totalClassified: 0,
        spamDetected: 0,
        falsePositives: 0,
        lastUpdated: new Date()
      }
    };

    const settings = user?.spamSettings || defaultSettings;

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching spam settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
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
    const settings = await request.json();

    // Validate settings
    const validSettings = {
      enabled: Boolean(settings.enabled),
      sensitivity: ['low', 'medium', 'high'].includes(settings.sensitivity) ? settings.sensitivity : 'medium',
      autoDelete: Boolean(settings.autoDelete),
      quarantineFolder: String(settings.quarantineFolder || 'spam'),
      whitelist: Array.isArray(settings.whitelist) ? settings.whitelist : [],
      blacklist: Array.isArray(settings.blacklist) ? settings.blacklist : [],
      notifications: Boolean(settings.notifications)
    };

    // Update user's spam settings
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          spamSettings: validSettings,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ 
      success: true, 
      settings: validSettings 
    });
  } catch (error) {
    console.error('Error updating spam settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
