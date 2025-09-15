// import { NextResponse } from 'next/server';
// import clientPromise from '../../../../lib/mongodb.js';
// import { mg } from '../../../../lib/mailgun.js';
// import crypto from 'crypto';

// // Verify Mailgun webhook signature
// function verifyWebhookSignature(token, timestamp, signature) {
//   if (!process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
//     console.log('No webhook signing key configured - skipping verification');
//     return true;
//   }
  
//   const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
//   const encodedToken = crypto
//     .createHmac('sha256', key)
//     .update(timestamp.concat(token))
//     .digest('hex');
  
//   return encodedToken === signature;
// }

// // Handle webhook verification (Mailgun sometimes sends GET requests to verify endpoint)
// export async function GET(request) {
//   console.log('Webhook verification GET request received');
//   return NextResponse.json({ status: 'Webhook endpoint is active' }, { status: 200 });
// }

// // Handle incoming emails
// export async function POST(request) {
//   console.log('Webhook POST request received');
  
//   try {
//     const formData = await request.formData();
    
//     // Log all form data for debugging
//     console.log('Webhook data received:');
//     for (let [key, value] of formData.entries()) {
//       if (key.startsWith('attachment-')) {
//         console.log(`${key}: [File: ${value.name}, Size: ${value.size}]`);
//       } else {
//         console.log(`${key}: ${value}`);
//       }
//     }
    
//     // Get webhook data
//     const token = formData.get('token');
//     const timestamp = formData.get('timestamp');
//     const signature = formData.get('signature');
    
//     // Verify webhook signature
//     if (process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
//       if (!verifyWebhookSignature(token, timestamp, signature)) {
//         console.log('Invalid webhook signature');
//         return NextResponse.json(
//           { error: 'Invalid signature' },
//           { status: 401 }
//         );
//       }
//     }

//     // Extract email data
//     const recipient = formData.get('recipient'); // The alias email
//     const sender = formData.get('sender');
//     const subject = formData.get('subject') || '(No Subject)';
//     const bodyPlain = formData.get('body-plain') || '';
//     const bodyHtml = formData.get('body-html') || '';
//     const messageHeaders = formData.get('message-headers');
//     const attachmentCount = parseInt(formData.get('attachment-count') || '0');
//     const messageId = formData.get('Message-Id');
    
//     console.log(`Processing email: ${sender} -> ${recipient}, Subject: ${subject}`);
    
//     // Parse message headers
//     let parsedHeaders = [];
//     try {
//       parsedHeaders = JSON.parse(messageHeaders || '[]');
//     } catch (e) {
//       console.log('Could not parse message headers:', e);
//       parsedHeaders = [];
//     }

//     // Connect to database
//     const client = await clientPromise;
//     const db = client.db();

//     // Find the alias and associated user
//     const alias = await db.collection('aliases').findOne({
//       aliasEmail: recipient,
//       isActive: { $ne: false } // Include documents where isActive is true or doesn't exist
//     });

//     if (!alias) {
//       console.log(`No active alias found for: ${recipient}`);
//       // Don't return error - just log and continue
//       return NextResponse.json({ message: 'Alias not found - email processed but not stored' }, { status: 200 });
//     }

//     console.log(`Found alias: ${alias.aliasEmail} for user: ${alias.userId}`);

//     // Get user details
//     const user = await db.collection('users').findOne({
//       _id: alias.userId
//     });

//     if (!user) {
//       console.log(`User not found for alias: ${recipient}`);
//       return NextResponse.json({ message: 'User not found' }, { status: 200 });
//     }

//     console.log(`Found user: ${user.email}`);

//     // Handle attachments
//     const attachments = [];
//     for (let i = 1; i <= attachmentCount; i++) {
//       const attachmentFile = formData.get(`attachment-${i}`);
//       if (attachmentFile) {
//         console.log(`Processing attachment ${i}: ${attachmentFile.name}`);
//         attachments.push({
//           filename: attachmentFile.name,
//           contentType: attachmentFile.type,
//           size: attachmentFile.size,
//           // In production, upload to cloud storage and store URL
//           // url: await uploadToCloudStorage(attachmentFile)
//         });
//       }
//     }

//     // Store email in database
//     const incomingEmail = {
//       aliasId: alias._id,
//       userId: alias.userId,
//       aliasEmail: recipient,
//       realEmail: alias.realEmail,
//       from: sender,
//       to: recipient,
//       subject: subject,
//       bodyPlain: bodyPlain,
//       bodyHtml: bodyHtml,
//       headers: parsedHeaders,
//       attachments: attachments,
//       isRead: false,
//       isForwarded: false,
//       receivedAt: new Date(),
//       messageId: messageId
//     };

//     const result = await db.collection('inbox').insertOne(incomingEmail);
//     console.log(`Email stored in database with ID: ${result.insertedId}`);

//     // Forward email to user's real email
//     try {
//       const forwardResult = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
//         from: `${alias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
//         to: user.email,
//         subject: `[${alias.aliasEmail}] ${subject}`,
//         text: `This email was sent to your alias: ${alias.aliasEmail}\n\nFrom: ${sender}\nSubject: ${subject}\n\n${bodyPlain}`,
//         html: bodyHtml ? `
//           <div style="border-left: 4px solid #3b82f6; padding-left: 16px; margin-bottom: 20px; background-color: #f8fafc; padding: 16px; border-radius: 8px;">
//             <p style="margin: 0 0 8px 0;"><strong>This email was sent to your alias:</strong> ${alias.aliasEmail}</p>
//             <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${sender}</p>
//             <p style="margin: 0;"><strong>Subject:</strong> ${subject}</p>
//           </div>
//           <div style="margin-top: 20px;">
//             ${bodyHtml}
//           </div>
//         ` : undefined,
//         'h:Reply-To': sender,
//         'o:tag': 'forwarded-email'
//       });

//       console.log(`Email forwarded to ${user.email}, Mailgun ID: ${forwardResult.id}`);

//       // Mark as forwarded
//       await db.collection('inbox').updateOne(
//         { _id: result.insertedId },
//         { $set: { isForwarded: true, forwardedAt: new Date() } }
//       );

//     } catch (forwardError) {
//       console.error('Error forwarding email:', forwardError);
//       // Don't fail the webhook if forwarding fails
//     }

//     return NextResponse.json({ 
//       message: 'Email processed successfully',
//       emailId: result.insertedId.toString(),
//       forwardedTo: user.email
//     });

//   } catch (error) {
//     console.error('Webhook processing error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error', details: error.message },
//       { status: 500 }
//     );
//   }
// }



// app/api/webhooks/mailgun/route.js - FIXED VERSION
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb.js';
import { mg } from '../../../../lib/mailgun.js';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  return NextResponse.json({ status: 'Webhook endpoint active' });
}

export async function POST(request) {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    
    const formData = await request.formData();
    
    // Extract email data
    const recipient = formData.get('recipient');
    const sender = formData.get('sender');
    const subject = formData.get('subject') || '(No Subject)';
    const bodyPlain = formData.get('body-plain') || '';
    const bodyHtml = formData.get('body-html') || '';
    const messageId = formData.get('Message-Id');
    
    console.log('Email received:', { from: sender, to: recipient, subject });

    if (!recipient || !sender) {
      console.log('Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Find alias - be flexible with the query
    // const alias = await db.collection('aliases').findOne({
    //   $or: [
    //     { aliasEmail: recipient },
    //     { aliasEmail: recipient.toLowerCase() }
    //   ],
    //   $or: [
    //     { isActive: { $ne: false } },
    //     { isActive: { $exists: false } }
    //   ]
    // });





    //=============GPT FIXIG CODE =================
    const alias = await db.collection('aliases').findOne({
  $and: [
    {
      $or: [
        { aliasEmail: recipient },
        { aliasEmail: recipient.toLowerCase() }
      ]
    },
    {
      $or: [
        { isActive: { $ne: false } },
        { isActive: { $exists: false } }
      ]
    }
  ]
});
    //============================================










    if (!alias) {
      console.log('No alias found for:', recipient);
      return NextResponse.json({ message: 'No alias found' }, { status: 200 });
    }

    console.log('Found alias:', alias.aliasEmail);

    // Get user
    // const user = await db.collection('users').findOne({ _id: alias.userId });
    const user = await db.collection('users').findOne({ _id: new ObjectId(alias.userId) });

    if (!user) {
      console.log('No user found for alias');
      return NextResponse.json({ message: 'No user found' }, { status: 200 });
    }

    console.log('Found user:', user.email);

    // Create email document - ensure userId matches the alias userId type
    const emailDoc = {
      aliasId: alias._id,
      userId: alias.userId, // Use the same type as stored in alias
      aliasEmail: recipient,
      realEmail: user.email,
      from: sender,
      to: recipient,
      subject: subject,
      bodyPlain: bodyPlain,
      bodyHtml: bodyHtml,
      headers: [],
      attachments: [],
      isRead: false,
      isForwarded: false,
      receivedAt: new Date(),
      messageId: messageId
    };

    console.log('Inserting email with userId:', emailDoc.userId, 'type:', typeof emailDoc.userId);

    const result = await db.collection('inbox').insertOne(emailDoc);
    console.log('Email inserted with ID:', result.insertedId);

    // Forward to user's real email
    try {
      await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `${alias.aliasEmail} <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: user.email,
        subject: `[${alias.aliasEmail}] ${subject}`,
        text: `Forwarded from: ${alias.aliasEmail}\nOriginal sender: ${sender}\n\n${bodyPlain}`,
        html: bodyHtml ? `
          <div style="background: #f3f4f6; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
            <p><strong>Forwarded from:</strong> ${alias.aliasEmail}</p>
            <p><strong>Original sender:</strong> ${sender}</p>
          </div>
          ${bodyHtml}
        ` : undefined,
        'h:Reply-To': sender
      });

      await db.collection('inbox').updateOne(
        { _id: result.insertedId },
        { $set: { isForwarded: true, forwardedAt: new Date() } }
      );

      console.log('Email forwarded successfully');
    } catch (forwardError) {
      console.error('Forward error (non-critical):', forwardError.message);
    }

    return NextResponse.json({ 
      message: 'Email processed successfully',
      emailId: result.insertedId.toString()
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
  }
}