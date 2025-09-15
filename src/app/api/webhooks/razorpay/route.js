import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const bodyText = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('No RAZORPAY_WEBHOOK_SECRET set; rejecting webhook');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(bodyText).digest('hex');
    if (expected !== signature) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(bodyText);
    const { event } = payload;
    const client = await clientPromise;
    const db = client.db();

    // Handle order.paid event (Razorpay will send different event types)
    if (event === 'order.paid' || event === 'payment.captured' || event === 'order.authorized') {
      // Try to get order entity with notes
      const orderEntity = payload.payload?.order?.entity || payload.payload?.payment?.entity || null;
      const notes = orderEntity?.notes || {};
      const userId = notes.userId;
      const orderId = orderEntity?.id || orderEntity?.order_id || null;

      if (userId) {
        await db.collection('users').updateOne(
          { _id: new (await import('mongodb')).ObjectId(userId) },
          { $set: { plan: 'pro', subscriptionId: orderId, upgradedAt: new Date() } }
        );
        // update payments collection if present
        await db.collection('payments').updateOne(
          { orderId: orderId },
          { $set: { status: 'paid', updatedAt: new Date() } }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
