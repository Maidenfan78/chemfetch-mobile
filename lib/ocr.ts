// lib/ocr.ts
import { Platform } from 'react-native';
// Pull the URL that was centralised in lib/constants.ts
import { OCR_API_URL } from './constants';

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
 * Defensive helper – returns parsed JSON when possible and otherwise throws a
 * useful error that includes the first 120 chars of the unexpected response.
 */
async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response from OCR service (${res.status}): ${text.slice(0, 120)}…`);
  }
}

/**
 * Converts a base-64 string to a Blob that can be appended to FormData.
 *
 * ⚠️  React Native's Blob polyfill only supports **string** parts (not
 *     ArrayBuffers or typed arrays).  Passing the raw binary string keeps us
 *     within the supported subset and avoids the “Creating blobs from
 *     ArrayBuffer and ArrayBufferView are not supported” error.
 */
function base64ToBlob(base64: string, mime = 'image/jpeg'): Blob {
  const binary = atob(base64); // binary string
  return new Blob([binary], { type: mime });
}

export async function runOcr(imageBase64: string, cropInfo: CropInfo): Promise<OcrResult> {
  try {
    // ----- Build multipart/form-data body ----------------------------------
    const form = new FormData();

    form.append(
      'image',
      base64ToBlob(imageBase64),
      `capture.${Platform.OS === 'ios' ? 'heic' : 'jpg'}`,
    );
    form.append('crop', JSON.stringify(cropInfo));

    const res = await fetch(`${OCR_API_URL}/ocr`, {
      method: 'POST',
      body: form,
    });

    if (__DEV__) console.info('[OCR] POST', `${OCR_API_URL}/ocr`, res.status);

    if (!res.ok) throw new Error(`OCR request failed with status ${res.status}`);

    const data: any = await safeJson(res);

    if (data.error) throw new Error(data.error);

    // ----- Extract best name / size ----------------------------------------
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