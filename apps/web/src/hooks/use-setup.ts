'use client';

import { useEffect, useState } from 'react';
import { loadSetup, staffToEmployees, clearSetup } from '@/lib/org-store';
import type { AppSetup } from '@/lib/org-store';
import { useRouter } from 'next/navigation';

export function useSetup() {
  const [setup, setSetup] = useState<AppSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const data = loadSetup();
    if (!data?.onboardingComplete) {
      router.replace('/onboarding');
    } else {
      setSetup(data);
    }
    setLoading(false);
  }, []);

  const employees = setup ? staffToEmployees(setup) : [];

  function resetApp() {
    clearSetup();
    router.replace('/onboarding');
  }

  return { setup, loading, employees, resetApp };
}
