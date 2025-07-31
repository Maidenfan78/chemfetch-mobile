import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import '../app/global.css';

export default function HomeScreen() {
  const router = useRouter(); 

  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-5xl text-light-100font-bold">Welcome! </Text>
      <Text className="text-base text-gray-600 mb-8 text-center">Scan and manage your chemical products</Text>

      <Pressable
        className="bg-primary py-3 px-6 rounded-lg mb-4"
        onPress={() => router.push('/barcode')}
      >
        <Text className="text-white text-base font-bold">📷 Start Scanning</Text>
      </Pressable>

      <Pressable
        className="bg-accent py-3 px-6 rounded-lg"
        onPress={() => router.push('/confirm?editOnly=1')}
      >
        <Text className="text-white text-base font-bold">✍️ Manual Entry</Text>
      </Pressable>

      // in HomeScreen
<Pressable
  className="bg-red-500 py-3 px-6 rounded-lg mt-4"
  onPress={async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  }}
>
  <Text className="text-white font-bold text-base">🚪 Log Out</Text>
</Pressable>

    </View>
  );
}
