import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

export default function SdsViewer() {
  const { url = '' } = useLocalSearchParams<{ url?: string }>();
  const decodedUrl = decodeURIComponent(url);
  const router = useRouter();

  const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!decodedUrl || typeof decodedUrl !== 'string') {
      setError('Invalid SDS URL');
      setLoading(false);
      return;
    }

    const downloadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const fileName = decodedUrl.split('/').pop()?.split('?')[0] || 'sds.pdf';
        const localPath = `${FileSystem.documentDirectory}${fileName}`;

        const downloaded = await FileSystem.downloadAsync(decodedUrl, localPath);
        if (downloaded.status !== 200) {
          throw new Error(`Download failed with status ${downloaded.status}`);
        }

        setLocalPdfUri(downloaded.uri);
      } catch (err: any) {
        console.error('❌ PDF download failed:', err);
        setError('Failed to download SDS PDF');
      } finally {
        setLoading(false);
      }
    };

    downloadPdf();
  }, [decodedUrl]);

  const openPdfExternally = async () => {
    if (!localPdfUri) return;

    try {
      if (Platform.OS === 'android') {
        // Convert file:/// to content:// and grant read permission
        const contentUri = await FileSystem.getContentUriAsync(localPdfUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/pdf',
        });
      } else {
        // iOS: Linking works, or use share sheet/browser as fallback
        try {
          await Linking.openURL(localPdfUri);
        } catch {
          await FileSystem.getContentUriAsync(localPdfUri); // no-op but keeps parity
          Alert.alert('Open PDF', 'If this does not open, try the Share button or view in-app.');
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open PDF externally. This viewer requires a PDF app.');
      console.error('❌ Failed to open PDF externally', e);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3A3D98" />
        <Text className="mt-4 text-dark-100">Downloading SDS…</Text>
      </View>
    );
  }

  if (error || !localPdfUri) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-center text-dark-100 mb-4">{error || 'Unknown error loading SDS.'}</Text>
        <Text className="text-accent" onPress={() => router.back()}>
          💙 Go Back
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
      <Text className="text-lg text-dark-100 text-center mb-4">SDS downloaded.</Text>
      <Pressable
        className="bg-primary py-3 px-6 rounded-lg mb-4"
        onPress={openPdfExternally}
      >
        <Text className="text-white font-bold text-center">📂 Open SDS</Text>
      </Pressable>
      <Pressable
        className="bg-gray-300 py-3 px-6 rounded-lg"
        onPress={() => router.replace('/register')}
      >
        <Text className="text-dark-100 font-medium text-center">🔙 Back to Register</Text>
      </Pressable>
    </View>
  );
}
