import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';

export default function OcrInfoScreen() {
  const router = useRouter();
  const { code = '', name = '', size = '' } = useLocalSearchParams<{
    code: string;
    name: string;
    size: string;
  }>();

  return (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-lg text-center mb-4">
        Position the product name within the frame and align it with the
        horizontal line on the next screen. Make sure the text is clear and
        readable.
      </Text>
      <Pressable
        className="bg-primary py-3 px-6 rounded-lg self-center"
        onPress={() =>
          router.replace({
            pathname: '/confirm',
            params: { code, name, size },
          })
        }
      >
        <Text className="text-white font-bold text-base">Next</Text>
      </Pressable>
    </View>
  );
}
