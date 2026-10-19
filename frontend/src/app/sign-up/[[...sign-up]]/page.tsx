import { Suspense } from 'react';
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="mb-6 text-center">
        <span
          className="text-4xl font-black tracking-tighter text-black select-none block"
          style={{ letterSpacing: '-2px' }}
        >
          Uber
        </span>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-800 text-xs font-semibold rounded-full border border-green-200">
          <span>🇮🇳</span>
          <span>Sign up with Indian Mobile (+91), Email, or Google</span>
        </div>
      </div>
      <Suspense fallback={<div className="text-neutral-400 text-sm">Loading sign-up...</div>}>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: 'shadow-xl rounded-2xl overflow-hidden max-w-full w-[400px]',
              card: 'shadow-none',
              headerTitle: 'text-xl font-bold',
              formButtonPrimary: 'bg-black hover:bg-neutral-800 text-white font-semibold py-3 rounded-xl',
            },
          }}
        />
      </Suspense>
    </div>
  );
}
