import { CropOverlay } from '@/components/CropOverlay';
import { SizePromptModal } from '@/components/SizePromptModal';
import { BACKEND_API_URL } from '@/lib/constants';
import { CropInfo, runOcr } from '@/lib/ocr';
import { useConfirmStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Confirm() {
  // ─────────────────────── navigation & params ───────────────────────
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused: boolean = (navigation as any).isFocused?.() ?? true;

  const {
    name = '',
    size = '',
    code = '',
    editOnly: editOnlyParam = '0',
  } = useLocalSearchParams<{
    name: string;
    size: string;
    code: string;
    editOnly?: string;
  }>();
  const editOnly = editOnlyParam === '1' || editOnlyParam === 'true';

  // ─────────────────────────── camera state ──────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  // ─────────────────────────── UI state ──────────────────────────────
  const [step, setStep] = useState<'photo' | 'crop' | 'pick' | 'edit'>(
    editOnly ? 'edit' : 'photo',
  );
  const [ocrResult, setOcrResult] = useState<{ bestName?: string; bestSize?: string }>({});
  const [error, setError] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // manual edit inputs
  const [manualName, setManualName] = useState(name);
  const [manualSize, setManualSize] = useState(size);

  // prompt when size missing
  const [sizePromptVisible, setSizePromptVisible] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingSize, setPendingSize] = useState('');

  // image / crop layout helpers
  const [imageLayout, setImageLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

  // ─────────────────────────── zustand store ─────────────────────────
  const photo = useConfirmStore((s) => s.photo);
  const crop = useConfirmStore((s) => s.crop);
  const setPhoto = useConfirmStore((s) => s.setPhoto);
  const clearPhoto = useConfirmStore((s) => s.clearPhoto);
  const resetCrop = useConfirmStore((s) => s.resetCrop);

  // ───────────────────── permissions & availability ──────────────────
  useEffect(() => {
    if (!editOnly && !permission) requestPermission();
  }, [editOnly, permission, requestPermission]);

  // retry until camera frees up (barcode screen may still be shutting down)
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      async function checkCamera(retries = 6) {
        if (!permission?.granted) return;
        for (let i = 0; i < retries; i += 1) {
          const available = await CameraView.isAvailableAsync();
          if (cancelled) return;
          if (available) {
            setCameraAvailable(true);
            setError('');
            return;
          }
          await new Promise((res) => setTimeout(res, 250));
        }
        if (!cancelled) {
          setCameraAvailable(false);
          setError('Camera still in use – go back and try again');
        }
      }
      checkCamera();
      return () => {
        cancelled = true;
      };
    }, [permission]),
  );

  // ─────────────────────────── helpers ───────────────────────────────
  const getCropInfo = (): CropInfo => ({
    left: Math.round(crop.leftRatio * imageLayout.width),
    top: Math.round(crop.topRatio * imageLayout.height),
    width: Math.round(crop.widthRatio * imageLayout.width),
    height: Math.round(crop.heightRatio * imageLayout.height),
    screenWidth: imageLayout.width,
    screenHeight: imageLayout.height,
    photoWidth: photo?.width ?? imageLayout.width,
    photoHeight: photo?.height ?? imageLayout.height,
  });

  const capture = async () => {
    if (!cameraAvailable) {
      Alert.alert('Capture Error', 'Camera not available');
      return;
    }
    if (!cameraRef.current) {
      Alert.alert('Capture Error', 'Camera not ready');
      return;
    }
    try {
      const pic = await cameraRef.current.takePictureAsync({ base64: false, quality: 1 });
      console.debug('[DEBUG][rawPhotoUri]', pic.uri);
      setPhoto(pic);
      resetCrop();
      setStep('crop');
    } catch (e: any) {
      Alert.alert('Capture Error', e?.message || String(e));
    }
  };

  const handleOcr = async () => {
    if (!photo) return;
    setOcrLoading(true);
    setError('');
    try {
      const result = await runOcr(photo.uri, getCropInfo());
      setOcrResult(result);
      setStep('pick');
    } catch (err: any) {
      setError(err.message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  const saveItem = async (finalName: string, finalSize: string) => {
    try {
      await fetch(`${BACKEND_API_URL}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: finalName, size: finalSize }),
      });
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Not logged in');
      const { data: product } = await supabase
        .from('product')
        .select('id')
        .eq('barcode', code)
        .single();
      if (!product) throw new Error('Product not found');
      await supabase
        .from('user_chemical_watch_list')
        .insert({ user_id: userId, product_id: product.id });
    } catch (e) {
      console.error('❌ Save error', e);
    }
    Alert.alert('Saved', `Name: ${finalName}\nSize/Weight: ${finalSize}`, [
      { text: 'OK', onPress: () => router.replace('/') },
    ]);
  };

  const confirmWithFallback = (n: string, s: string) => {
    if (!s.trim()) {
      setPendingName(n);
      setPendingSize('');
      setSizePromptVisible(true);
    } else {
      saveItem(n, s);
    }
  };

  // ───────────────────── permission guard UI ────────────────────────
  if (!editOnly) {
    if (!permission) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator />
        </View>
      );
    }
    if (!permission.granted) {
      return (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center mb-4">We need camera access to capture your SDS label.</Text>
          <Button title="Grant permission" onPress={requestPermission} />
        </View>
      );
    }
  }

  // ─────────────────────────── content ──────────────────────────────
  let content: React.ReactNode = null;

// ───── Edit (manual entry) step ─────
if (step === 'edit') {
  content = (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-lg font-semibold mb-4">Edit Product Details</Text>
      <TextInput
        className="border border-gray-400 rounded-md px-4 py-2 w-full mb-3"
        placeholder="Name"
        value={manualName}
        onChangeText={setManualName}
      />
      <TextInput
        className="border border-gray-400 rounded-md px-4 py-2 w-full mb-4"
        placeholder="Size/Weight"
        value={manualSize}
        onChangeText={setManualSize}
      />
      <Button title="Save" onPress={() => confirmWithFallback(manualName, manualSize)} />
    </View>
  );
}


  // ───── Take photo step ─────
  else if (step === 'photo') {
    content = (
      <View className="flex-1 bg-white">
        {photo ? (
          <Image source={{ uri: photo.uri }} className="flex-1" resizeMode="cover" />
        ) : (
          isFocused && cameraAvailable && (
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              onLayout={(e: LayoutChangeEvent) => {
                const { width, height } = e.nativeEvent.layout;
                setImageLayout({ width, height });
              }}
              onCameraReady={() => setCameraReady(true)}
            />
          )
        )}
        <View className="absolute bottom-6 left-0 right-0 items-center">
          <Pressable
            className={`py-3 px-6 rounded-lg ${cameraReady || photo ? 'bg-primary' : 'bg-gray-400'}`}
            disabled={!cameraReady && !photo}
            onPress={() => (photo ? clearPhoto() : capture())}
          >
            <Text className="text-white font-bold text-base">{photo ? 'Retake' : 'Capture'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ───── Crop step ─────
  else if (step === 'crop' && photo) {
    content = (
      <View className="flex-1 bg-white">
        <Image
          source={{ uri: photo.uri }}
          className="flex-1"
          resizeMode="contain"
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setImageLayout({ width, height });
          }}
        />
        <CropOverlay
          cropBoxStyle={{
            left: crop.leftRatio * imageLayout.width,
            top: crop.topRatio * imageLayout.height,
            width: crop.widthRatio * imageLayout.width,
            height: crop.heightRatio * imageLayout.height,
          }}
        />
        <View className="absolute bottom-6 left-0 right-0 items-center">
          {ocrLoading ? (
            <ActivityIndicator size="large" />
          ) : (
            <Button title="Confirm" onPress={handleOcr} />
          )}
        </View>
      </View>
    );
  }

  // ───── Pick result step ─────
  else if (step === 'pick') {
    content = (
      <View className="flex-1 bg-white p-6 justify-center">
        <Text className="text-center text-lg font-semibold mb-6">Choose the correct product details:</Text>

        {/* Show barcode/web data */}
        <View className="border border-gray-300 rounded-lg p-4 mb-4 bg-light-100">
          <Text className="font-bold text-dark-100 mb-1">📦 Barcode/Web Result</Text>
          <Text className="text-dark-100">Name: {name || 'N/A'}</Text>
          <Text className="text-dark-100 mb-2">Size: {size || 'N/A'}</Text>
          <Button title="Use Barcode/Web Result" onPress={() => confirmWithFallback(name, size)} />
        </View>

        {/* Show OCR data */}
        <View className="border border-gray-300 rounded-lg p-4 mb-4 bg-light-100">
          <Text className="font-bold text-dark-100 mb-1">🔍 OCR Result</Text>
          <Text className="text-dark-100">Name: {ocrResult.bestName || 'N/A'}</Text>
          <Text className="text-dark-100 mb-2">Size: {ocrResult.bestSize || 'N/A'}</Text>
          <Button
            title="Use OCR Result"
            onPress={() =>
              confirmWithFallback(ocrResult.bestName || '', ocrResult.bestSize || '')
            }
          />
        </View>

        {/* Manual fallback */}
        <View className="mt-4">
          <Button title="✍️ Edit Manually" onPress={() => setStep('edit')} />
        </View>

        {/* Prompt for missing size */}
        <SizePromptModal
          visible={sizePromptVisible}
          name={pendingName}
          size={pendingSize}
          onChangeSize={setPendingSize}
          onSave={() => {
            setSizePromptVisible(false);
            saveItem(pendingName, pendingSize.trim());
          }}
          onCancel={() => setSizePromptVisible(false)}
        />
      </View>
    );
  }


  // ───── Fallback error / unknown state ─────
  else {
    content = (
      <View className="flex-1 justify-center items-center">
        <Text>No content</Text>
      </View>
    );
  }

  // ─────────────────────────── render ───────────────────────────────
  return (
    <>
      {content}
      {error ? (
        <View className="absolute bottom-2 left-0 right-0 items-center">
          <Text className="text-red-600" testID="error-message">
            {error}
          </Text>
        </View>
      ) : null}
    </>
  );
}      