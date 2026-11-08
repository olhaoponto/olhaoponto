import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { WelcomeSplash } from '@/components/WelcomeSplash';

export default function WelcomeRoute() {
  const router = useRouter();
  const continueToToday = useCallback(() => { router.replace('/(tabs)'); }, [router]);

  return <WelcomeSplash onContinue={continueToToday} />;
}
