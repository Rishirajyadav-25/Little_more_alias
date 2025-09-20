import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text, subject, sender } = await request.json();
    
    if (!text && !subject) {
      return NextResponse.json({ error: 'Text or subject is required' }, { status: 400 });
    }
    
    const fullText = `${subject || ''} ${text || ''}`.toLowerCase();
    
    // Simple spam detection
    const spamKeywords = ['free', 'win', 'congratulations', 'urgent', 'click here', 'limited time', 'act now', 'winner', 'prize', 'cash', 'money'];
    let spamScore = 0;
    
    spamKeywords.forEach(keyword => {
      if (fullText.includes(keyword)) {
        spamScore += 1;
      }
    });
    
    const isSpam = spamScore > 1;
    const confidence = Math.min(spamScore / 3, 1);
    
    return NextResponse.json({
      isSpam,
      confidence,
      reason: isSpam ? 'Spam keywords detected' : 'No spam indicators found'
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to classify email',
      isSpam: false,
      confidence: 0.5,
      reason: 'Classification service unavailable'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    modelLoaded: true,
    classifierType: 'simple'
  });
}