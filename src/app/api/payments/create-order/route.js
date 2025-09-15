import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { verifyToken } from '../../../../lib/auth.js';

export async function POST(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const decoded = verifyToken(token);

    const client = await clientPromise;
    const db = client.db();

    const user = await db.collection('users').findOne({ _id: new (await import('mongodb')).ObjectId(decoded.userId) });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.plan === 'pro') {
      return NextResponse.json({ error: 'You already have Pro plan' }, { status: 400 });
    }

    const body = await request.json();
    // amount in rupees from env or default to 499
    const amountInRupees = Number(process.env.RAZORPAY_PRO_AMOUNT_RUPEES || 499);
    const amountPaise = Math.round(amountInRupees * 100);

    // Create Razorpay order via REST API
    const creds = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${creds}`
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `r_${user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`,
        notes: { userId: user._id.toString(), email: user.email }
      })

    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error('Razorpay order creation failed', orderData);
      return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
    }

    // Persist order info (optional)
    await db.collection('payments').insertOne({
      userId: user._id,
      orderId: orderData.id,
      amount: amountPaise,
      currency: 'INR',
      status: 'created',
      createdAt: new Date()
    });

    return NextResponse.json({ order: orderData }, { status: 201 });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
