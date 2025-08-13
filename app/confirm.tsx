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

type OcrPayload = {
  bestName?: string;
  bestSize?: string;
  lines?: string[]; // first OCR lines (optional)
  confidence?: number; // 0..1 (optional)
};

export default function Confirm() {
  // ─────────────────────── navigation & params ───────────────────────
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused: boolean = (navigation as any).isFocused?.() ?? true;

  const {
    name: nameParam = '',
    size: sizeParam = '',
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
  const [step, setStep] = useState<'photo' | 'crop' | 'pick'>(
    editOnly ? 'pick' : 'photo',
  );
  const [ocrResult, setOcrResult] = useState<OcrPayload>({});
  const [error, setError] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // preview values coming from Web (scan/API) and params
  const [webName, setWebName] = useState(nameParam);
  const [webSize, setWebSize] = useState(sizeParam);

  // manual inputs (used by Manual panel)
  const [manualName, setManualName] = useState(nameParam);
  const [manualSize, setManualSize] = useState(sizeParam);

  // current selection in the 3‑way choice
  const [choice, setChoice] = useState<'web' | 'ocr' | 'manual'>(
    webName ? 'web' : 'manual',
  );

  // prompt when size missing
  const [sizePromptVisible, setSizePromptVisible] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingSize, setPendingSize] = useState('');

  // saving feedback
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

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
      // result may already include lines[] and confidence
      setOcrResult({
        bestName: (result as any).bestName,
        bestSize: (result as any).bestSize,
        lines: (result as any).lines ?? [],
        confidence: (result as any).confidence,
      });
      setStep('pick');
      setChoice('ocr');
    } catch (err: any) {
      setError(err.message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  // Persist product (upsert) and add to user's watch list if possible
  const persistProduct = async (finalName: string, finalSize: string) => {
    try {
      await fetch(`${BACKEND_API_URL}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: finalName, size: finalSize }),
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const { data: product } = await supabase
        .from('product')
        .select('id')
        .eq('barcode', code)
        .single();

      if (userId && product?.id) {
        const { error: wlError } = await supabase
          .from('user_chemical_watch_list')
          .insert({ user_id: userId, product_id: product.id });
        if (wlError) {
          console.warn('watch_list insert skipped:', wlError.message);
        }
      }
    } catch (e) {
      console.error('❌ Persist error', e);
    }
  };

  // SDS: search → verify → upsert product.sds_url via Supabase client
  const searchVerifyAndUpsertSds = async (finalName: string) => {
    try {
      const sdsRes = await fetch(`${BACKEND_API_URL}/sds-by-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalName }),
      });
      const sds = await sdsRes.json();
      const url: string | undefined = sds.sdsUrl || sds.url;
      if (!url) return;

      // verify before persisting
      const verRes = await fetch(`${BACKEND_API_URL}/verify-sds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name: finalName }),
      });
      const ver = await verRes.json();
      if (ver?.verified !== false) {
        const { data: product } = await supabase
          .from('product')
          .select('id')
          .eq('barcode', code)
          .single();
        if (product?.id) {
          await supabase.from('product').update({ sds_url: url }).eq('id', product.id);
        }
      }
    } catch (e) {
      console.error('SDS lookup/verify failed', e);
    }
  };

  const onSubmitChoice = async () => {
    let finalName = '';
    let finalSize = '';

    if (choice === 'web') {
      finalName = webName.trim();
      finalSize = webSize.trim();
    } else if (choice === 'ocr') {
      finalName = (ocrResult.bestName || '').trim();
      finalSize = (ocrResult.bestSize || '').trim();
    } else {
      finalName = manualName.trim();
      finalSize = manualSize.trim();
    }

    if (!finalName) {
      Alert.alert('Missing name', 'Please provide a product name.');
      return;
    }

    // if size missing, prompt first
    if (!finalSize) {
      setPendingName(finalName);
      setPendingSize('');
      setSizePromptVisible(true);
      return;
    }

    try {
      setSaving(true);
      await persistProduct(finalName, finalSize);
      await searchVerifyAndUpsertSds(finalName);
      setShowSaved(true);
      setTimeout(() => {
        setShowSaved(false);
        router.replace('/');
      }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const confirmSizeFromPrompt = async () => {
    const n = pendingName;
    const s = pendingSize.trim();
    setSizePromptVisible(false);
    if (!s) return;
    try {
      setSaving(true);
      await persistProduct(n, s);
      await searchVerifyAndUpsertSds(n);
      setShowSaved(true);
      setTimeout(() => {
        setShowSaved(false);
        router.replace('/');
      }, 1000);
    } finally {
      setSaving(false);
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

  // ───── Take photo step ─────
  if (!editOnly && step === 'photo') {
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
            className={`py-3 px-6 rounded-lg ${photo ? 'bg-primary' : cameraReady ? 'bg-primary' : 'bg-gray-400'}`}
            disabled={!cameraReady && !photo}
            onPress={() => (photo ? clearPhoto() : capture())}
          >
            <Text className="text-white font-bold text-base">{photo ? 'Retake' : 'Capture'}</Text>
          </Pressable>
          {photo ? (
            <Pressable
              className="mt-3 py-3 px-6 rounded-lg bg-accent"
              onPress={() => setStep('crop')}
            >
              <Text className="text-white font-bold text-base">Next: Crop</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // ───── Crop step ─────
  else if (!editOnly && step === 'crop' && photo) {
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
            <Button title="Run OCR" onPress={handleOcr} />
          )}
        </View>
      </View>
    );
  }

  // ───── Three‑way choice (Web / OCR / Manual) ─────
  else {
    content = (
      <View className="flex-1 bg-white p-6">
        <Text className="text-center text-lg font-semibold mb-4">Confirm product details</Text>

        <View className="flex-col space-y-4">
          {/* Web panel */}
          <Pressable
            onPress={() => setChoice('web')}
            className={`border rounded-xl p-4 ${choice === 'web' ? 'border-primary bg-blue-50' : 'border-gray-300 bg-light-100'}`}
          >
            <Text className="font-bold mb-1">🌐 Web (Item {code || '—'})</Text>
            <Text className="text-dark-100">Name: {webName || '—'}</Text>
            <Text className="text-dark-100">Size: {webSize || '—'}</Text>
            {!webName && (
              <Text className="text-xs text-gray-500 mt-1">No web result provided. You can pick OCR or Manual.</Text>
            )}
          </Pressable>

          {/* OCR panel */}
          <Pressable
            onPress={() => setChoice('ocr')}
            className={`border rounded-xl p-4 ${choice === 'ocr' ? 'border-primary bg-blue-50' : 'border-gray-300 bg-light-100'}`}
          >
            <Text className="font-bold mb-1">🧾 OCR</Text>
            <Text className="text-dark-100">Name: {ocrResult.bestName || '—'}</Text>
            <Text className="text-dark-100">Size: {ocrResult.bestSize || '—'}</Text>
            {(ocrResult.lines?.length ?? 0) > 0 && (
              <Text className="text-xs text-gray-600 mt-1" numberOfLines={2}>
                {ocrResult.lines!.slice(0, 2).join(' • ')}
              </Text>
            )}
            {typeof ocrResult.confidence === 'number' && (
              <Text className="text-xs text-gray-500 mt-1">Confidence: {(ocrResult.confidence * 100).toFixed(0)}%</Text>
            )}
            {!ocrResult.bestName && (
              <Text className="text-xs text-gray-500 mt-1">No OCR yet. {photo ? 'Run OCR below.' : 'Capture → Crop → Run OCR.'}</Text>
            )}
          </Pressable>

          {/* Manual panel */}
          <Pressable
            onPress={() => setChoice('manual')}
            className={`border rounded-xl p-4 ${choice === 'manual' ? 'border-primary bg-blue-50' : 'border-gray-300 bg-light-100'}`}
          >
            <Text className="font-bold mb-2">✍️ Manual</Text>
            <View className="space-y-2">
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 text-dark-100 bg-white"
                placeholder="Product name"
                value={manualName}
                onChangeText={setManualName}
                editable={choice === 'manual'}
              />
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 text-dark-100 bg-white"
                placeholder="Size/weight"
                value={manualSize}
                onChangeText={setManualSize}
                editable={choice === 'manual'}
              />
            </View>
          </Pressable>
        </View>

        {/* Actions */}
        <View className="mt-6 space-y-3">
          {!editOnly && (
            <View className="flex-row justify-between">
              <Pressable
                className="bg-gray-200 py-3 px-4 rounded-lg flex-1 mr-2"
                onPress={() => setStep('photo')}
              >
                <Text className="text-center text-dark-100 font-semibold">📷 Capture</Text>
              </Pressable>
              <Pressable
                className="bg-gray-200 py-3 px-4 rounded-lg flex-1 ml-2"
                onPress={() => (photo ? setStep('crop') : Alert.alert('No photo', 'Capture a photo first.'))}
              >
                <Text className="text-center text-dark-100 font-semibold">🖼️ Crop / OCR</Text>
              </Pressable>
            </View>
          )}

          <Pressable className="bg-primary py-3 px-4 rounded-lg" onPress={onSubmitChoice}>
            <Text className="text-center text-white font-bold">Save & Find SDS</Text>
          </Pressable>

          <Pressable className="bg-gray-300 py-3 px-4 rounded-lg" onPress={() => router.replace('/') }>
            <Text className="text-center text-dark-100 font-semibold">Cancel</Text>
          </Pressable>
        </View>

        <SizePromptModal
          visible={sizePromptVisible}
          name={pendingName}
          size={pendingSize}
          onChangeSize={setPendingSize}
          onSave={confirmSizeFromPrompt}
          onCancel={() => setSizePromptVisible(false)}
        />
      </View>
    );
  }

  // ─────────────────────────── render ───────────────────────────────
  return (
    <>
      {content}
      {saving && (
        <View className="absolute inset-0 bg-black/40 justify-center items-center">
          <ActivityIndicator size="large" color="#fff" />
          <Text className="text-white mt-2">Saving...</Text>
        </View>
      )}
      {showSaved && (
        <View className="absolute top-4 left-0 right-0 items-center">
          <View className="bg-green-600 px-4 py-2 rounded-lg">
            <Text className="text-white font-semibold">Item saved</Text>
          </View>
        </View>
      )}
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
