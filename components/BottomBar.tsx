// components/BottomBar.tsx
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const BottomBar = () => {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView edges={["bottom"]} className="bg-white">
      <View className="flex-row justify-around py-2 border-t border-gray-200 bg-white">
        <Pressable onPress={() => router.replace('/')} className="flex-1 items-center">
          <Text className="text-sm text-gray-700">Home</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/watchlist')} className="flex-1 items-center">
          <Text className="text-sm text-gray-700">Watch List</Text>
        </Pressable>
        <Pressable onPress={handleLogout} className="flex-1 items-center">
          <Text className="text-sm text-gray-700">Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
