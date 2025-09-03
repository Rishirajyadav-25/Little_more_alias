'use client';
import { Suspense } from 'react';
import SignIn from './SignIn';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <SignIn />
    </Suspense>
  );
}
