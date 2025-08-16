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

// ================================================================
// Checksum validators & normalizers for common retail symbologies
// We normalize to a canonical GTIN when possible:
//  - EAN-13 => GTIN-13 (as-is)
//  - UPC-A (12) => prepend '0' -> GTIN-13
//  - UPC-E (8) => expand to UPC-A then prepend '0' -> GTIN-13
//  - EAN-8 => GTIN-8 (as-is)
//  - ITF-14 => GTIN-14 (as-is)
// Code128/Code39/Code93 may encode a GTIN; if the payload is purely
// digits with a valid length/checksum, we use it. Otherwise ignored.
// ================================================================

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

function isValidUPCA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const d = code.split('').map(Number);
  let sum = 0;
  // positions 0,2,4,6,8,10 weighted by 3; 1,3,5,7,9,11 by 1 (but 11 is check)
  for (let i = 0; i < 11; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  return check === d[11];
}

// Expand UPC-E (NS 0/1) to UPC-A (per GS1 rules). Returns null if invalid.
function expandUPCEtoUPCA(upce: string): string | null {
  if (!/^\d{8}$/.test(upce)) return null;
  const d = upce.split('').map(Number);
  const numberSystem = d[0];
  const checkDigit = d[7];
  if (numberSystem !== 0 && numberSystem !== 1) return null; // only NS 0/1 supported here
  const mfr = `${d[1]}${d[2]}${d[3]}`;
  const prod = `${d[4]}${d[5]}${d[6]}`;
  let upcaBody = '';
  switch (d[6]) {
    case 0:
    case 1:
    case 2:
      // MFG: M1 M2 R6, PROD: 0000 R4 R5
      upcaBody = `${numberSystem}${d[1]}${d[2]}${d[6]}0000${d[3]}${d[4]}${d[5]}`;
      break;
    case 3:
      // MFG: M1 M2 M3, PROD: 00000 R4
      upcaBody = `${numberSystem}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
      break;
    case 4:
      // MFG: M1 M2 M3 M4, PROD: 00000 R5
      upcaBody = `${numberSystem}${d[1]}${d[2]}${d[3]}${d[4]}00000${d[5]}`;
      break;
    default:
      // 5-9: MFG: M1 M2 M3 M4 M5, PROD: 0000 R6
      upcaBody = `${numberSystem}${d[1]}${d[2]}${d[3]}${d[4]}${d[5]}0000${d[6]}`;
  }
  // calculate UPC-A checksum
  const digits = upcaBody.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  if (check !== checkDigit) return null;
  return `${upcaBody}${check}`; // 12-digit UPC-A
}

function isValidUPCE(code: string): boolean {
  const upca = expandUPCEtoUPCA(code);
  return !!upca; // expansion verified checksum
}

function isValidITF14(code: string): boolean {
  if (!/^\d{14}$/.test(code)) return false;
  const d = code.split('').map(Number);
  let sum = 0; // same mod-10 scheme as EAN-13 over first 13 digits
  for (let i = 0; i < 13; i++) sum += d[i] * (i % 2 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  return check === d[13];
}

// Normalize scanned payload to a canonical GTIN string we store/use.
function normalizeToGtin(raw: string): string | null {
  const data = (raw || '').trim();
  if (!data) return null;
  // Pure numeric? Try the standard GTIN forms.
  if (/^\d+$/.test(data)) {
    if (data.length === 8 && isValidEAN8(data)) return data;           // GTIN-8
    if (data.length === 12 && isValidUPCA(data)) return `0${data}`;    // UPC-A -> GTIN-13
    if (data.length === 13 && isValidEAN13(data)) return data;         // GTIN-13
    if (data.length === 14 && isValidITF14(data)) return data;         // GTIN-14
  }
  // UPC-E (8) encoded sometimes reported as payload w/ checksum
  if (/^\d{8}$/.test(data) && isValidUPCE(data)) {
    const upca = expandUPCEtoUPCA(data)!; // checked by isValidUPCE
    return `0${upca}`.slice(0, 13); // UPC-A -> GTIN-13
  }
  // Some 1D symbologies (Code128/39/93) may carry a GTIN as digits; if so, try to parse
  const digits = data.replace(/\D+/g, '');
  if (digits) {
    const n = normalizeToGtin(digits);
    if (n) return n;
  }
  return null; // unsupported payload
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
    counts: Record<string, number>; // keyed by normalized GTIN
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
    const gtin = normalizeToGtin(raw);
    if (!gtin) return null; // ignore unsupported/invalid payloads

    const now = Date.now();
    const buf = bufferRef.current;

    // roll the time window
    if (!buf.firstTs || now - buf.firstTs > SCAN_WINDOW_MS) {
      buf.firstTs = now;
      buf.counts = {};
    }

    buf.counts[gtin] = (buf.counts[gtin] || 0) + 1;
    if (buf.counts[gtin] >= SCAN_CONFIRMATIONS) {
      resetBuffer();
      return gtin;
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

    // we have a confirmed + normalized GTIN
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
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'ean8',
                    'ean13',
                    'upc_a',
                    'upc_e',
                    'itf14',
                    'code128',
                    'code39',
                    'code93',
                  ],
                }}
              />
            )}
          </View>

          {/* Overlay aim box */}
          <View className="absolute inset-0 justify-center items-center pointer-events-none">
            <View className="w-[70%] h-48 border-4 border-white rounded-xl bg-white/10 justify-center items-center">
              <Text className="text-white font-bold text-base text-center px-4">
                Align barcode here (EAN/UPC/ITF/Code128/39)
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
