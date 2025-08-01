// app/confirm.tsx
import { CropOverlay } from '@/components/CropOverlay';
import { SizePromptModal } from '@/components/SizePromptModal';
import { BACKEND_API_URL } from '@/lib/constants';
import { CropInfo, runOcr } from '@/lib/ocr';
import { useConfirmStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  const router = useRouter();
  const { name = '', size = '', code = '', editOnly: editOnlyParam = '0' } =
    useLocalSearchParams<{ name: string; size: string; code: string; editOnly?: string }>();
  const editOnly = editOnlyParam === '1' || editOnlyParam === 'true';

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<'photo' | 'crop' | 'pick' | 'edit'>('photo');
  const [ocrResult, setOcrResult] = useState<{ bestName?: string; bestSize?: string }>({});
  const [error, setError] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  const [manualName, setManualName] = useState(name);
  const [manualSize, setManualSize] = useState(size);

  const [sizePromptVisible, setSizePromptVisible] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingSize, setPendingSize] = useState('');

  const [imageLayout, setImageLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(true);

  const cameraRef = useRef<any>(null);

  const photo = useConfirmStore((s) => s.photo);
  const crop = useConfirmStore((s) => s.crop);
  const setPhoto = useConfirmStore((s) => s.setPhoto);
  const clearPhoto = useConfirmStore((s) => s.clearPhoto);
  const resetCrop = useConfirmStore((s) => s.resetCrop);

  useEffect(() => {
    if (!editOnly) requestPermission();
  }, [editOnly, requestPermission]);

  useEffect(() => {
    const checkCamera = async () => {
      if (permission?.granted) {
        try {
          const available = await CameraView.isAvailableAsync();
          setCameraAvailable(available);
          if (!available) {
            setError('Camera not available on this device');
          }
        } catch {
          setCameraAvailable(false);
          setError('Camera not available');
        }
      }
    };
    checkCamera();
  }, [permission]);

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
    setError('');
    if (!cameraAvailable) {
      Alert.alert('Capture Error', 'No camera available on this device');
      return;
    }
    if (!cameraRef.current) {
      setError('Camera not ready');
      Alert.alert('Capture Error', 'Camera not initialized properly');
      return;
    }
    try {
      const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 1 });
      setPhoto(pic);
      resetCrop();
      setStep('crop');
    } catch (e: any) {
      console.error('❌ Camera capture failed:', e);
      setError(e?.message || String(e));
      Alert.alert('Capture Error', e?.message || String(e));
    }
  };

  const handleOcr = async () => {
    if (!photo) return;
    setOcrLoading(true);
    setError('');
    try {
      const result = await runOcr(photo.base64, getCropInfo());
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
      const { data: product, error: pErr } = await supabase
        .from('product')
        .select('id')
        .eq('barcode', code)
        .single();
      if (pErr) throw pErr;
      const { error: insertErr } = await supabase
        .from('user_chemical_watch_list')
        .insert({ user_id: userId, product_id: product.id });
      if (insertErr) throw insertErr;
      console.log('✅ Added to watch list');
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
      return;
    }
    saveItem(n, s);
  };

  let content: React.ReactNode = null;

  if (editOnly) {
    content = (
      <View className="flex-1 bg-white justify-center items-center p-6">
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
  } else if (!permission?.granted) {
    content = <Text className="text-center mt-10">No camera access</Text>;
  } else if (!cameraAvailable) {
    content = <Text className="text-center mt-10">Camera not available</Text>;
  } else if (step === 'photo') {
    content = (
      <View className="flex-1 bg-white">
        {photo ? (
          <Image source={{ uri: photo.uri }} className="flex-1" resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            onLayout={(e: LayoutChangeEvent) => {
              const { width, height } = e.nativeEvent.layout;
              console.log('📸 Camera layout:', width, height);
              setImageLayout({ width, height });
            }}
            onCameraReady={() => {
              console.log('✅ Camera ready');
              setCameraReady(true);
            }}
          />
        )}
        <View className="absolute bottom-6 left-0 right-0 items-center">
          <Pressable
            className={`py-3 px-6 rounded-lg ${cameraReady ? 'bg-primary' : 'bg-gray-400'}`}
            disabled={!cameraReady}
            onPress={() => (photo ? clearPhoto() : capture())}
          >
            <Text className="text-white font-bold text-base">{photo ? 'Retake' : 'Capture'}</Text>
          </Pressable>
        </View>
      </View>
    );
  } else if (step === 'crop' && photo) {
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
  } else if (step === 'pick') {
    content = (
      <View className="flex-1 bg-white p-6 justify-center">
        <Text className="text-center text-lg font-semibold mb-6">Choose the correct product details:</Text>
        <View className="space-y-4">
          <Button title="Use Barcode/Web Result" onPress={() => confirmWithFallback(name, size)} />
          <Button
            title="Use OCR Result"
            onPress={() => confirmWithFallback(ocrResult.bestName || '', ocrResult.bestSize || '')}
          />
          <Button title="Edit Manually" onPress={() => setStep('edit')} />
        </View>
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

  return (
    <>
      {content}
      {error ? (
        <View className="absolute bottom-2 left-0 right-0 items-center">
          <Text className="text-red-600" testID="error-message">{error}</Text>
        </View>
      ) : null}
    </>
  );
}
