import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
      <Text className="text-3xl font-bold mb-3 text-center text-primary">Welcome to ChemFetch</Text>
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
    </View>
  );
}
