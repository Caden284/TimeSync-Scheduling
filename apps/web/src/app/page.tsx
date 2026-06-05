'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isOnboardingComplete } from '@/lib/org-store';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    if (isOnboardingComplete()) {
      router.replace('/schedule');
    } else {
      router.replace('/onboarding');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );
}
