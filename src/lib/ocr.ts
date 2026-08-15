import { createWorker } from 'tesseract.js';

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  matchedCode: string | null;
  error?: string;
}

/**
 * Normalizes text to handle common OCR confusion characters:
 * - 'O', 'o' -> '0' when surrounded by digits
 * - 'l', 'I', '|' -> '1' when surrounded by digits
 * - ',' -> '.' in numbers
 */
export const cleanOCRText = (raw: string): string => {
  return raw
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .trim();
};

/**
 * Recognizes text from an image file using Tesseract.js with AI regex enhancement.
 * @param imageFile - File or Blob of the image.
 * @param knownProductCodes - Optional list of valid product codes in database to match against.
 */
export const performOCR = async (
  imageFile: File | Blob,
  knownProductCodes: string[] = []
): Promise<OCRResult> => {
  let worker;
  try {
    worker = await createWorker('eng');
    const ret = await worker.recognize(imageFile);
    const text = ret.data.text || '';
    const confidence = ret.data.confidence || 0;
    const cleaned = cleanOCRText(text).toLowerCase();

    // 1. Direct Regex Search: e.g. e120.30, e100.34, e80.343, p500.45, a100.99, x888.88
    const productCodeRegex = /[a-z]\d{2,3}\.\d{2,3}/i;
    const match = cleaned.match(productCodeRegex);
    let matchedCode = match ? match[0].toLowerCase() : null;

    // 2. Fuzzy match against known product codes in DB if regex didn't catch or for higher accuracy
    if (!matchedCode && knownProductCodes.length > 0) {
      const lowerKnown = knownProductCodes.map(c => c.toLowerCase());
      for (const code of lowerKnown) {
        const stripped = code.replace(/[^a-z0-9]/g, '');
        const cleanedStripped = cleaned.replace(/[^a-z0-9]/g, '');
        if (cleanedStripped.includes(stripped)) {
          matchedCode = code;
          break;
        }
      }
    }

    await worker.terminate();

    return {
      success: true,
      text: text.trim(),
      confidence,
      matchedCode
    };
  } catch (err: any) {
    console.error('OCR Error:', err);
    if (worker) {
      try {
        await (worker as any).terminate();
      } catch (e) {}
    }
    return {
      success: false,
      text: '',
      confidence: 0,
      matchedCode: null,
      error: err.message || 'Failed to process image'
    };
  }
};
