// app/_layout.tsx
import { supabase } from '@/lib/supabase';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import '../app/global.css';

export default function RootLayout() {
  const router = useRouter();
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.replace('/login');
    };

    checkAuth();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false, // 👈 Hides header on all screens
      }}
    />
  );
}
