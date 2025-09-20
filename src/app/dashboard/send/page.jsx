'use client';
import { Suspense } from 'react';
import SendEmail from './SendEmail.js';

export default function SendPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SendEmail />
    </Suspense>
  );
}