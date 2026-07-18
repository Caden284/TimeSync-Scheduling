'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function RootPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace(profile?.role === 'staff' ? '/my-schedule' : '/schedule');
  }, [loading, user, profile]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );
}
