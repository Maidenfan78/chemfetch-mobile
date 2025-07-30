import { BACKEND_API_URL } from './constants';

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

export async function runOcr(imageBase64: string, cropInfo: CropInfo): Promise<OcrResult> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, cropInfo }),
    });

    const data = await res.json();

    if (data.error) throw new Error(data.error);

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
    console.error('OCR Error:', err.message);
    throw err;
  }
}
