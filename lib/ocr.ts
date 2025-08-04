import { Platform } from 'react-native';
// Centralised OCR endpoint URL
import { OCR_API_URL } from './constants';
// Expo FileSystem for file existence checks
import * as FileSystem from 'expo-file-system';

export interface OcrResult {
  bestName?: string;
  bestSize?: string;
  text?: string;
}

export interface CropInfo {
  left: number;
  top: number;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
  photoWidth: number;
  photoHeight: number;
}

/**
 * Helper – parse JSON or throw with a truncated preview of unexpected content
 */
async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Unexpected response from OCR service (${res.status}): ${text.slice(0, 120)}…`
    );
  }
}

/**
 * Upload a file URI via multipart/form-data with minimal debug logging
 */
export async function runOcr(
  imageUri: string,
  cropInfo: CropInfo
): Promise<OcrResult> {
  // Log raw URI for debugging
  console.debug('[DEBUG][imageUri]', imageUri);

  // Check file existence
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    console.debug('[DEBUG][file exists]', info.exists);
  } catch (e) {
    console.warn('[DEBUG][file] Could not check file', e);
  }

  try {
    const form: any = new FormData();
    console.debug(
      '[DEBUG][form parts before]',
      form._parts?.map((p: any[]) => p[0])
    );

    // Append crop metadata
    form.append('crop', JSON.stringify(cropInfo));

    // Append image file
    const fileName = `capture.${Platform.OS === 'ios' ? 'heic' : 'jpg'}`;
    form.append(
      'image',
      { uri: imageUri, name: fileName, type: 'image/jpeg' },
      fileName
    );

    console.debug(
      '[DEBUG][form parts after]',
      form._parts?.map((p: any[]) => p[0])
    );
    console.info('[OCR Debug] Posting to', `${OCR_API_URL}/ocr`);

    const res = await fetch(`${OCR_API_URL}/ocr`, {
      method: 'POST',
      body: form,
    });

    if (__DEV__) console.info('[OCR] POST status', res.status);
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[OCR Debug] Server error body:', errBody);
      throw new Error(`OCR request failed with status ${res.status}`);
    }

    const data: any = await safeJson(res);
    if (data.error) throw new Error(data.error);

    // Extract bestName and bestSize
    let bestName = '';
    let bestSize = '';

    if (data?.predominant?.text) {
      bestName = String(data.predominant.text).replace(/\n+/g, ' ').trim();
    } else if (typeof data.text === 'string') {
      bestName = data.text.replace(/\n+/g, ' ').trim();
    }

    if (Array.isArray(data.lines)) {
      for (const line of data.lines) {
        const txt = String(line.text || '').trim();
        if (!bestSize) {
          const m = txt.match(/(\d+(?:\.\d+)?\s?(?:ml|mL|g|kg|oz|l))/);
          if (m) bestSize = m[0];
        }
      }
    }

    if (!bestSize && typeof data.text === 'string') {
      const m = data.text.match(/(\d+(?:\.\d+)?\s?(?:ml|mL|g|kg|oz|l))/);
      if (m) bestSize = m[0];
    }

    return { bestName, bestSize, text: data.text };
  } catch (err: any) {
    console.error('OCR Error:', err.message || err);
    throw err;
  }
}
