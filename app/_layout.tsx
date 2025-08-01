// app/_layout.tsx
import { BottomBar } from '@/components/BottomBar';
import { supabase } from '@/lib/supabase';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
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
    <View className="flex-1">
      <Stack
        screenOptions={{
          headerShown: false, // 👈 Hides header on all screens
        }}
      />
      <BottomBar />
    </View>
  );
}
