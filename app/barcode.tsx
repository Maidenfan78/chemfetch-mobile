import { BACKEND_API_URL } from '@/lib/constants';
import { useIsFocused } from '@react-navigation/native';
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ------- Tuning knobs -------
const SCAN_CONFIRMATIONS = 2;     // how many identical reads required
const SCAN_WINDOW_MS = 1200;      // time window to accumulate confirmations
const RESCAN_COOLDOWN_MS = 1200;  // how long before allowing another scan

// ------- Checksum validators -------
function isValidEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const d = code.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6];
  const even = d[1] + d[3] + d[5];
  const sum = odd * 3 + even;
  const check = (10 - (sum % 10)) % 10;
  return check === d[7];
}

function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const d = code.split('').map(Number);
  let sum = 0; // weight 1 at even indices (0‑based), 3 at odd
  for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  return check === d[12];
}

function looksLikeSupportedEAN(code: string): boolean {
  return (code.length === 8 && isValidEAN8(code)) ||
         (code.length === 13 && isValidEAN13(code));
}

export default function BarcodeScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);       // camera accepting reads
  const [confirming, setConfirming] = useState(false);  // showing "confirming" UI
  const [loading, setLoading] = useState(false);        // backend call in flight
  const router = useRouter();
  const isFocused = useIsFocused();

  // rolling buffer to tally codes within a short window
  const bufferRef = useRef<{
    counts: Record<string, number>;
    firstTs: number;
  }>({ counts: {}, firstTs: 0 });

  // cooldown timer after a confirmed scan
  const cooldownRef = useRef<number>(0);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  if (!permission) return <Text className="text-center p-4">Loading permissions…</Text>;
  if (!permission.granted) return <Text className="text-center p-4">No camera access 🙁</Text>;

  const resetBuffer = () => {
    bufferRef.current = { counts: {}, firstTs: 0 };
    setConfirming(false);
  };

  const maybeConfirm = (raw: string) => {
    const code = (raw || '').trim();
    if (!looksLikeSupportedEAN(code)) return null;

    const now = Date.now();
    const buf = bufferRef.current;

    // roll the time window
    if (!buf.firstTs || now - buf.firstTs > SCAN_WINDOW_MS) {
      buf.firstTs = now;
      buf.counts = {};
    }

    buf.counts[code] = (buf.counts[code] || 0) + 1;
    if (buf.counts[code] >= SCAN_CONFIRMATIONS) {
      resetBuffer();
      return code;
    }

    setConfirming(true);
    return null;
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (!scanning || loading) return;

    // simple cooldown (prevents rapid-fire duplicate confirmations)
    if (Date.now() - cooldownRef.current < RESCAN_COOLDOWN_MS) return;

    const confirmed = maybeConfirm(data);
    if (!confirmed) return;

    // we have a confirmed + checksummed EAN
    setScanning(false);
    setConfirming(false);
    setLoading(true);
    Vibration.vibrate(80);

    fetch(`${BACKEND_API_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: confirmed }),
    })
      .then((res) => res.json())
      .then((json) => {
        const prod = json.product ?? json;
        router.replace({
          pathname: '/ocr-info',
          params: {
            code: confirmed,
            name: prod.product_name || prod.name || '',
            size: prod.contents_size_weight || prod.size || '',
          },
        });
      })
      .catch((err) => {
        console.error('❌ Backend error:', err);
        router.replace({ pathname: '/ocr-info', params: { code: confirmed } });
      })
      .finally(() => {
        setLoading(false);
        cooldownRef.current = Date.now();
      });
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {loading ? (
        <View className="flex-1 justify-center items-center bg-black">
          <Image
            source={require('@/assets/images/splash-icon.png')}
            className="w-32 h-32 mb-4"
          />
          <ActivityIndicator size="large" color="#fff" />
          <Text className="text-white mt-2">Searching...</Text>
        </View>
      ) : (
        <>
          <View className="flex-1">
            {isFocused && (
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
                barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13'] }}
              />
            )}
          </View>

          {/* Overlay aim box */}
          <View className="absolute inset-0 justify-center items-center pointer-events-none">
            <View className="w-[70%] h-48 border-4 border-white rounded-xl bg-white/10 justify-center items-center">
              <Text className="text-white font-bold text-base text-center px-4">
                Align barcode here
              </Text>
            </View>
          </View>

          {/* Confirming hint */}
          {confirming && !loading && (
            <View className="absolute bottom-24 self-center bg-black/70 px-4 py-2 rounded-lg">
              <Text className="text-white">Hold steady… confirming barcode</Text>
            </View>
          )}

          {/* Scan Again button (after a read) */}
          {!scanning && !loading && (
            <Pressable
              className="absolute bottom-10 self-center bg-primary py-3 px-6 rounded-lg"
              onPress={() => {
                resetBuffer();
                setScanning(true);
              }}
            >
              <Text className="text-white text-base font-bold">Scan Again</Text>
            </Pressable>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
