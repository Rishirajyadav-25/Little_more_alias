// Test script for spam filtering functionality
// Run with: node test-spam-filter.js

const testEmails = [
  {
    subject: "Congratulations! You've won $1000!",
    text: "Congratulations! You have won $1000 in our lottery! Click here to claim your prize now! Limited time offer!",
    sender: "winner@lottery.com",
    expected: "spam"
  },
  {
    subject: "Meeting tomorrow at 2 PM",
    text: "Hi, I wanted to confirm our meeting tomorrow at 2 PM. Please let me know if you can make it. Best regards, John",
    sender: "john@company.com",
    expected: "ham"
  },
  {
    subject: "URGENT: Verify your account NOW!",
    text: "URGENT!!! Your account will be suspended if you don't verify it immediately! Click here to verify: http://fake-bank.com/verify",
    sender: "noreply@fake-bank.com",
    expected: "spam"
  },
  {
    subject: "Project update and next steps",
    text: "Hi team, here's the latest update on our project. We've completed phase 1 and are ready to move to phase 2. Please review the attached documents.",
    sender: "project.manager@company.com",
    expected: "ham"
  },
  {
    subject: "FREE MONEY!!! ACT NOW!!!",
    text: "GET RICH QUICK!!! Make $5000 a day from home!!! No experience needed!!! Click here to start earning NOW!!!",
    sender: "getrich@spam.com",
    expected: "spam"
  }
];

async function testSpamClassification() {
  console.log('🧪 Testing Spam Classification System\n');
  
  for (let i = 0; i < testEmails.length; i++) {
    const email = testEmails[i];
    console.log(`Test ${i + 1}: ${email.subject}`);
    console.log(`From: ${email.sender}`);
    console.log(`Expected: ${email.expected.toUpperCase()}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/spam/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: email.text,
          subject: email.subject,
          sender: email.sender
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const actual = result.isSpam ? 'spam' : 'ham';
        const correct = actual === email.expected;
        
        console.log(`Result: ${actual.toUpperCase()} (${(result.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`Reason: ${result.reason}`);
        console.log(`✅ ${correct ? 'CORRECT' : 'INCORRECT'}`);
        
        if (!correct) {
          console.log(`❌ Expected ${email.expected.toUpperCase()}, got ${actual.toUpperCase()}`);
        }
      } else {
        console.log('❌ Failed to classify email');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('─'.repeat(50));
  }
}

// Run the test
testSpamClassification().catch(console.error);
