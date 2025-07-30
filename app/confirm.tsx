// app/confirm.tsx (refactor using Zustand for photo and crop)
import { CropOverlay } from '@/components/CropOverlay';
import { SizePromptModal } from '@/components/SizePromptModal';
import { CropInfo, runOcr } from '@/lib/ocr';
import { BACKEND_API_URL } from '@/lib/constants';
import { useConfirmStore } from '@/lib/store';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Dimensions, Image, Text, TextInput, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Confirm() {
  const router = useRouter();
  const {
    name = '',
    size = '',
    code = '',
    editOnly: editOnlyParam = '0',
  } = useLocalSearchParams<{ name: string; size: string; code: string; editOnly?: string }>();

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
  const cameraRef = useRef<CameraView>(null);

  const photo = useConfirmStore((s) => s.photo);
  const crop = useConfirmStore((s) => s.crop);
  const setPhoto = useConfirmStore((s) => s.setPhoto);
  const clearPhoto = useConfirmStore((s) => s.clearPhoto);
  const setCrop = useConfirmStore((s) => s.setCrop);
  const resetCrop = useConfirmStore((s) => s.resetCrop);

  useEffect(() => {
    if (!editOnly) requestPermission();
  }, [editOnly]);

  const getCropInfo = (): CropInfo => {
    return {
      left: Math.round(crop.leftRatio * imageLayout.width),
      top: Math.round(crop.topRatio * imageLayout.height),
      width: Math.round(crop.widthRatio * imageLayout.width),
      height: Math.round(crop.heightRatio * imageLayout.height),
      screenWidth: imageLayout.width,
      screenHeight: imageLayout.height,
      photoWidth: photo?.width ?? imageLayout.width,
      photoHeight: photo?.height ?? imageLayout.height,
    };
  };

  const capture = async () => {
    setError('');
    if (!cameraRef.current) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 1 });
      setPhoto(pic);
      resetCrop();
      setStep('crop');
    } catch (e: any) {
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
    } catch (e) {
      console.error('Save error', e);
    }

    Alert.alert('Saved', `Name: ${finalName}\nSize/Weight: ${finalSize}`, [
      {
        text: 'OK',
        onPress: () => router.replace('/'),
      },
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

  if (editOnly) {
    return (
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
  }

  if (!permission?.granted) return <Text className="text-center mt-10">No camera access</Text>;

  if (step === 'photo') {
    return (
      <View className="flex-1 bg-white">
        {photo ? (
          <Image source={{ uri: photo.uri }} className="flex-1" resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            className="flex-1"
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setImageLayout({ width, height });
            }}
          />
        )}
        <View className="absolute bottom-6 left-0 right-0 items-center">
          <Button title={photo ? 'Retake' : 'Capture'} onPress={() => (photo ? clearPhoto() : capture())} />
        </View>
      </View>
    );
  }

  if (step === 'crop' && photo) {
    return (
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

  if (step === 'pick') {
    return (
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

  return null;
}