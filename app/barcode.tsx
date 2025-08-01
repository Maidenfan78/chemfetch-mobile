import { BACKEND_API_URL } from '@/lib/constants';
import { useIsFocused } from '@react-navigation/native';
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function BarcodeScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const isFocused = useIsFocused();

  useEffect(() => {
    requestPermission();
  }, []);

  if (!permission) return <Text className="text-center p-4">Loading permissions…</Text>;
  if (!permission.granted) return <Text className="text-center p-4">No camera access 🙁</Text>;

const handleBarcodeScanned = ({ type, data }: BarcodeScanningResult) => {
  console.log('🔍 Barcode scanned:', { type, data });

  setScanned(true);
  Vibration.vibrate(100);

  console.log('📡 Sending scan to backend...');
  fetch(`${BACKEND_API_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: data }),
  })
    .then((res) => res.json())
    .then((json) => {
      console.log('✅ Response from backend:', json);
      const prod = json.product ?? json;
      router.replace({
        pathname: '/confirm',
        params: {
          code: data,
          name: prod.product_name || prod.name || '',
          size: prod.contents_size_weight || prod.size || '',
        },
      });
    })
    .catch((err) => {
      console.error('❌ Backend error:', err);
      router.replace({ pathname: '/confirm', params: { code: data } });
    });
};

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1">
        {isFocused && (
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13'] }}
          />
        )}
      </View>

      <View className="absolute inset-0 justify-center items-center">
        <View className="w-[70%] h-48 border-4 border-white rounded-xl bg-white/10 justify-center items-center">
          <Text className="text-white font-bold text-base text-center px-4">
            Align barcode here
          </Text>
        </View>
      </View>

      {scanned && (
        <Pressable
          className="absolute bottom-10 self-center bg-primary py-3 px-6 rounded-lg"
          onPress={() => setScanned(false)}
        >
          <Text className="text-white text-base font-bold">Scan Again</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
