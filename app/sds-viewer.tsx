import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function SdsViewer() {
  const { url = '' } = useLocalSearchParams<{ url?: string }>();
  const router = useRouter();

  if (!url || typeof url !== 'string') {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg text-center text-dark-100">No SDS URL provided.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <WebView
        source={{ uri: decodeURIComponent(url) }}
        startInLoadingState
        renderLoading={() => (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3A3D98" />
          </View>
        )}
      />
    </View>
  );
}
